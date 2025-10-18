/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  consoleFetchJSON,
  k8sGet,
  K8sResourceCommon,
  K8sResourceKind,
  MatchExpression,
  MatchLabels,
} from '@openshift-console/dynamic-plugin-sdk';
import { HttpError } from '@openshift-console/dynamic-plugin-sdk/lib/utils/error/http-error';
import _ from 'lodash';
import { RefObject, useEffect } from 'react';
import {
  ALL_NAMESPACES_KEY,
  DELETED_RESOURCE_IN_K8S_ANNOTATION,
  RESOURCE_LOADED_FROM_RESULTS_ANNOTATION,
  TEKTON_RESULTS_FETCH_URL,
  TEKTON_RESULTS_TASKRUN_LOGS_URL,
} from '../../consts';
import { RouteModel, TektonResultModel } from '../../models';
import {
  DataType,
  DevConsoleEndpointResponse,
  PipelineRunKind,
  RecordsList,
  TaskRunKind,
  TaskRunLogRequest,
  TektonResultsOptions,
  TRRequest,
} from '../../types';
import {
  consoleProxyFetch,
  consoleProxyFetchJSON,
  ProxyRequest,
} from './proxy';

// REST API spec
// https://github.com/tektoncd/results/blob/main/docs/api/rest-api-spec.md

// const URL_PREFIX = `/apis/results.tekton.dev/v1alpha2/parents/`;

export const MINIMUM_PAGE_SIZE = 5;
export const MAXIMUM_PAGE_SIZE = 10000;

let cachedTektonResultsAPI: string = null;

const throw404 = () => {
  // eslint-disable-next-line no-throw-literal
  throw { code: 404 };
};

// decoding result base64
export const decodeValue = (value: string) => atob(value);

export const decodeValueJson = (value: string) => {
  const decodedValue = value ? JSON.parse(decodeValue(value)) : null;
  let resourceDeletedInK8sAnnotation;
  if (_.has(decodedValue?.metadata, 'deletionTimestamp')) {
    delete decodedValue?.metadata?.deletionTimestamp;
    resourceDeletedInK8sAnnotation = {
      [DELETED_RESOURCE_IN_K8S_ANNOTATION]: 'true',
    };
  }
  const decodedValueWithTRAnnotation = decodedValue
    ? {
        ...decodedValue,
        metadata: {
          ...decodedValue?.metadata,
          annotations: {
            ...decodedValue?.metadata?.annotations,
            [RESOURCE_LOADED_FROM_RESULTS_ANNOTATION]: 'true',
            ...resourceDeletedInK8sAnnotation,
          },
        },
      }
    : null;
  return decodedValueWithTRAnnotation;
};

// filter functions
export const AND = (...expressions: string[]) =>
  expressions.filter((x) => x).join(' && ');
export const OR = (...expressions: string[]) => {
  const filteredExpressions = expressions.filter((x) => x);
  const filter = filteredExpressions.join(' || ');
  return filteredExpressions.length > 1 ? `(${filter})` : filter;
};

const EXP = (left: string, right: string, operator: string) =>
  `${left} ${operator} ${right}`;
export const EQ = (left: string, right: string) =>
  EXP(left, `"${right}"`, '==');
export const NEQ = (left: string, right: string) =>
  EXP(left, `"${right}"`, '!=');

export const labelsToFilter = (labels?: MatchLabels): string =>
  labels
    ? AND(
        ...Object.keys(labels).map((label) =>
          EQ(`data.metadata.labels["${label}"]`, labels[label]),
        ),
      )
    : '';

export const nameFilter = (name?: string): string =>
  name
    ? AND(`data.metadata.name.startsWith("${name.trim().toLowerCase()}")`)
    : '';

export const expressionsToFilter = (
  expressions: Omit<MatchExpression, 'value'>[],
): string =>
  AND(
    ...expressions
      .map((expression) => {
        switch (expression.operator) {
          case 'Exists':
            return `data.metadata.labels.contains("${expression.key}")`;
          case 'DoesNotExist':
            return `!data.metadata.labels.contains("${expression.key}")`;
          case 'NotIn':
            return expression.values?.length > 0
              ? AND(
                  ...expression.values.map((value) =>
                    NEQ(`data.metadata.labels["${expression.key}"]`, value),
                  ),
                )
              : '';
          case 'In':
            return expression.values?.length > 0
              ? `data.metadata.labels["${
                  expression.key
                }"] in [${expression.values.map((value) => `"${value}"`)}]`
              : '';
          case 'Equals':
            return expression.values?.[0]
              ? EQ(
                  `data.metadata.labels["${expression.key}"]`,
                  expression.values?.[0],
                )
              : '';
          case 'NotEquals':
          case 'NotEqual':
            return expression.values?.[0]
              ? NEQ(
                  `data.metadata.labels["${expression.key}"]`,
                  expression.values?.[0],
                )
              : '';
          case 'GreaterThan':
            return expression.values?.[0]
              ? EXP(
                  `data.metadata.labels["${expression.key}"]`,
                  expression.values?.[0],
                  '>',
                )
              : '';
          case 'LessThan':
            return expression.values?.[0]
              ? EXP(
                  `data.metadata.labels["${expression.key}"]`,
                  expression.values?.[0],
                  '<',
                )
              : '';
          default:
            throw new Error(
              `Tekton results operator '${expression.operator}' conversion not implemented.`,
            );
        }
      })
      .filter((x) => x),
  );

export const selectorToFilter = (selector) => {
  let filter = '';
  if (selector) {
    const { matchLabels, matchExpressions, filterByName } = selector;

    if (filterByName) {
      filter = AND(filter, nameFilter(filterByName as string));
    }

    if (matchLabels || matchExpressions) {
      if (matchLabels) {
        filter = AND(filter, labelsToFilter(matchLabels));
      }
      if (matchExpressions) {
        filter = AND(filter, expressionsToFilter(matchExpressions));
      }
    } else {
      filter = labelsToFilter(selector as MatchLabels);
    }
  }
  return filter;
};

// Devs should be careful to not cache a response that may not be complete.
// In most situtations, caching is unnecessary.
// Only cache a response that returns a single complete record as lists can change over time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CACHE: { [key: string]: [any[], RecordsList] } = {};
export const clearCache = () => {
  CACHE = {};
};
const InFlightStore: { [key: string]: boolean } = {};

export const fetchTektonResultsURLConfig = async (
  namespace: string,
  dataType?: DataType,
  filter?: string,
  options?: TektonResultsOptions,
  nextPageToken?: string,
): Promise<TRRequest> => {
  const searchNamespace =
    namespace && namespace !== ALL_NAMESPACES_KEY ? namespace : '-';
  const searchParams = `${new URLSearchParams({
    // default sort should always be by `create_time desc`
    // order_by: 'create_time desc', not supported yet
    page_size: `${Math.max(
      MINIMUM_PAGE_SIZE,
      Math.min(
        MAXIMUM_PAGE_SIZE,
        options?.limit >= 0 ? options.limit : options?.pageSize ?? 50,
      ),
    )}`,
    ...(nextPageToken ? { page_token: nextPageToken } : {}),
    filter: AND(
      EQ('data_type', dataType.toString()),
      filter,
      selectorToFilter(options?.selector),
      options?.filter,
    ),
  }).toString()}`;
  return { searchNamespace, searchParams };
};

/**
 * Fetches the Tekton results from the Tekton Results API.
 * @param tRRequest The request object containing the search namespace and search parameters
 * @returns The parsed results list
 */
const fetchTektonResults = async (
  tRRequest: TRRequest,
): Promise<RecordsList> => {
  const resultListResponse: DevConsoleEndpointResponse =
    await consoleFetchJSON.post(TEKTON_RESULTS_FETCH_URL, tRRequest);

  if (!resultListResponse.statusCode) {
    throw new Error('Unexpected proxy response: Status code is missing!');
  }
  if (
    resultListResponse.statusCode < 200 ||
    resultListResponse.statusCode >= 300
  ) {
    throw new HttpError(
      `Unexpected status code: ${resultListResponse.statusCode}`,
      resultListResponse.statusCode,
      null,
      resultListResponse,
    );
  }
  try {
    return JSON.parse(resultListResponse.body) as RecordsList;
  } catch (e) {
    throw new Error('Failed to parse task details response body as JSON');
  }
};

export const getFilteredRecord = async <R extends K8sResourceCommon>(
  namespace: string,
  dataType: DataType,
  filter?: string,
  options?: TektonResultsOptions,
  nextPageToken?: string,
  cacheKey?: string,
  isDevConsoleProxyAvailable?: boolean,
): Promise<[R[], RecordsList, boolean?]> => {
  if (cacheKey) {
    const result = CACHE[cacheKey];
    if (result) {
      return result;
    }
    if (InFlightStore[cacheKey]) {
      return [
        [],
        {
          nextPageToken: null,
          records: [],
        },
        true,
      ];
    }
  }
  InFlightStore[cacheKey] = true;

  const value = await (async (): Promise<[R[], RecordsList]> => {
    try {
      if (isDevConsoleProxyAvailable) {
        const { searchNamespace, searchParams } =
          await fetchTektonResultsURLConfig(
            namespace,
            dataType,
            filter,
            options,
            nextPageToken,
          );

        let list: RecordsList = await fetchTektonResults({
          searchNamespace,
          searchParams,
        });

        if (options?.limit >= 0) {
          list = {
            nextPageToken: null,
            records: list.records.slice(0, options.limit),
          };
        }

        return [
          list.records.map((result) => decodeValueJson(result.data.value)),
          list,
        ];
      } else {
        const url = await createTektonResultsUrl(
          namespace,
          dataType,
          filter,
          options,
          nextPageToken,
        );

        let list: RecordsList = await consoleProxyFetchJSON({
          url,
          method: 'GET',
          allowInsecure: true,
          allowAuthHeader: true,
        });

        if (options?.limit >= 0) {
          list = {
            nextPageToken: null,
            records: list.records.slice(0, options.limit),
          };
        }

        return [
          list.records.map((result) => decodeValueJson(result.data.value)),
          list,
        ];
      }
    } catch (e) {
      if (e?.code === 404) {
        return [
          [],
          {
            nextPageToken: null,
            records: [],
          },
        ] as [R[], RecordsList];
      }
      throw e;
    }
  })();

  if (cacheKey) {
    InFlightStore[cacheKey] = false;
    CACHE[cacheKey] = value;
  }
  return value;
};

const getFilteredPipelineRuns = (
  namespace: string,
  filter: string,
  options?: TektonResultsOptions,
  nextPageToken?: string,
  cacheKey?: string,
  isDevConsoleProxyAvailable?: boolean,
) =>
  getFilteredRecord<PipelineRunKind>(
    namespace,
    DataType.PipelineRun,
    filter,
    options,
    nextPageToken,
    cacheKey,
    isDevConsoleProxyAvailable,
  );

const getFilteredTaskRuns = (
  namespace: string,
  filter: string,
  options?: TektonResultsOptions,
  nextPageToken?: string,
  cacheKey?: string,
  isDevConsoleProxyAvailable?: boolean,
) =>
  getFilteredRecord<TaskRunKind>(
    namespace,
    DataType.TaskRun,
    filter,
    options,
    nextPageToken,
    cacheKey,
    isDevConsoleProxyAvailable,
  );

export const getPipelineRuns = (
  namespace: string,
  options?: TektonResultsOptions,
  nextPageToken?: string,
  // supply a cacheKey only if the PipelineRun is complete and response will never change in the future
  cacheKey?: string,
  isDevConsoleProxyAvailable?: boolean,
) =>
  getFilteredPipelineRuns(
    namespace,
    '',
    options,
    nextPageToken,
    cacheKey,
    isDevConsoleProxyAvailable,
  );

export const getTaskRuns = (
  namespace: string,
  options?: TektonResultsOptions,
  nextPageToken?: string,
  // supply a cacheKey only if the TaskRun is complete and response will never change in the future
  cacheKey?: string,
  isDevConsoleProxyAvailable?: boolean,
) =>
  getFilteredTaskRuns(
    namespace,
    '',
    options,
    nextPageToken,
    cacheKey,
    isDevConsoleProxyAvailable,
  );

const isJSONString = (str: string): boolean => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

/**
 * Fetches the task run logs from the Tekton Results API.
 * @param taskRunLogRequest The request object containing the task run path.
 * @returns The task run logs.
 */
const fetchTaskRunLogs = async <T extends string | object>(
  taskRunLogRequest: TaskRunLogRequest,
): Promise<T> => {
  const taskRunLogResponse: DevConsoleEndpointResponse =
    await consoleFetchJSON.post(
      TEKTON_RESULTS_TASKRUN_LOGS_URL,
      taskRunLogRequest,
    );

  if (!taskRunLogResponse.statusCode) {
    throw new Error('Unexpected proxy response: Status code is missing!');
  }
  if (
    taskRunLogResponse.statusCode < 200 ||
    taskRunLogResponse.statusCode >= 300
  ) {
    throw new HttpError(
      `Unexpected status code: ${taskRunLogResponse.statusCode}`,
      taskRunLogResponse.statusCode,
      null,
      taskRunLogResponse,
    );
  }

  const body = taskRunLogResponse.body;

  if (isJSONString(body)) {
    return JSON.parse(body) as T;
  }

  return body as T;
};

export const getTaskRunLog = async (
  taskRunPath: string,
  isDevConsoleProxyAvailable?: boolean,
): Promise<string> => {
  if (!taskRunPath) {
    throw404();
  }

  const logPath = taskRunPath.replace('/records/', '/logs/');

  if (isDevConsoleProxyAvailable) {
    return fetchTaskRunLogs({ taskRunPath: logPath });
  } else {
    const tektonResultsAPI = await getTektonResultsAPIUrl();
    const url = `https://${tektonResultsAPI}/apis/results.tekton.dev/v1alpha2/parents/${logPath}`;
    return consoleProxyFetchLog({
      url,
      method: 'GET',
      allowInsecure: true,
      allowAuthHeader: true,
    });
  }
};

export const useLoadMoreOnScroll = (
  loadMoreRef: RefObject<HTMLElement>,
  nextPageToken: (() => void) | null,
  loaded: boolean,
) => {
  useEffect(() => {
    if (!loadMoreRef.current || !loaded) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting && nextPageToken) {
        nextPageToken();
      }
    });
    observer.observe(loadMoreRef.current);
    return () => {
      observer.disconnect();
    };
  }, [nextPageToken, loaded, loadMoreRef]);
};

export const getTektonResultsAPIUrl = async () => {
  if (cachedTektonResultsAPI) {
    return cachedTektonResultsAPI;
  } else {
    const cachedTektonResult: K8sResourceKind = await k8sGet({
      model: TektonResultModel,
      name: 'result',
    });
    const targetNamespace = cachedTektonResult?.spec?.targetNamespace;
    const serverPort = cachedTektonResult?.spec?.server_port ?? '8080';
    const tlsHostname = cachedTektonResult?.spec?.tls_hostname_override;
    if (tlsHostname) {
      cachedTektonResultsAPI = `${tlsHostname}:${serverPort}`;
    } else if (targetNamespace && serverPort) {
      cachedTektonResultsAPI = `tekton-results-api-service.${targetNamespace}.svc.cluster.local:${serverPort}`;
    } else {
      cachedTektonResultsAPI = `tekton-results-api-service.openshift-pipelines.svc.cluster.local:${serverPort}`;
    }
    return cachedTektonResultsAPI;
  }
};

export const createTektonResultsUrl = async (
  namespace: string,
  dataType: DataType,
  filter?: string,
  options?: TektonResultsOptions,
  nextPageToken?: string,
): Promise<string> => {
  const tektonResultsAPI = await getTektonResultsAPIUrl();

  const namespaceToSearch =
    namespace && namespace !== ALL_NAMESPACES_KEY ? namespace : '-';
  const URL = `https://${tektonResultsAPI}/apis/results.tekton.dev/v1alpha2/parents/${namespaceToSearch}/results/-/records?${new URLSearchParams(
    {
      // default sort should always be by `create_time desc`
      // order_by: 'create_time desc', not supported yet
      page_size: `${Math.max(
        MINIMUM_PAGE_SIZE,
        Math.min(
          MAXIMUM_PAGE_SIZE,
          options?.limit >= 0 ? options.limit : options?.pageSize ?? 50,
        ),
      )}`,
      ...(nextPageToken ? { page_token: nextPageToken } : {}),
      filter: AND(
        EQ('data_type', dataType.toString()),
        filter,
        selectorToFilter(options?.selector),
        options?.filter,
      ),
    },
  ).toString()}`;
  return URL;
};

export const createTektonResultsSummaryUrl = async (
  namespace: string,
  options?: TektonResultsOptions,
  nextPageToken?: string,
): Promise<string> => {
  const tektonResultsAPI = await getTektonResultsAPIUrl();
  const namespaceToSearch =
    namespace && namespace !== ALL_NAMESPACES_KEY ? namespace : '-';
  const URL = `https://${tektonResultsAPI}/apis/results.tekton.dev/v1alpha2/parents/${namespaceToSearch}/results/-/records/summary?${new URLSearchParams(
    {
      summary: `${options?.summary}`,
      ...(options?.groupBy ? { group_by: `${options.groupBy}` } : {}),
      // default sort should always be by `create_time desc`
      // order_by: 'create_time desc', not supported yet
      page_size: `${Math.max(
        MINIMUM_PAGE_SIZE,
        Math.min(
          MAXIMUM_PAGE_SIZE,
          options?.limit >= 0 ? options.limit : options?.pageSize ?? 30,
        ),
      )}`,
      ...(nextPageToken ? { page_token: nextPageToken } : {}),
      filter: AND(
        EQ('data_type', options.data_type?.toString()),
        options.filter,
        selectorToFilter(options?.selector),
      ),
    },
  ).toString()}`;
  return URL;
};

export const consoleProxyFetchLog = <T>(
  proxyRequest: ProxyRequest,
): Promise<T> => {
  return consoleProxyFetch(proxyRequest).then((response) => {
    return isJSONString(response.body)
      ? JSON.parse(response.body)
      : response.body;
  });
};

export const getTRURLHost = async () => {
  const tektonResult: K8sResourceKind = await k8sGet({
    model: TektonResultModel,
    name: 'result',
  });
  const targetNamespace = tektonResult?.spec?.targetNamespace;
  const route: K8sResourceKind = await k8sGet({
    model: RouteModel,
    name: 'tekton-results-api-service',
    ns: targetNamespace,
  });
  return route?.spec.host;
};
