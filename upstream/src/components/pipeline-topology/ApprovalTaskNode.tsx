import * as React from 'react';
import classnames from 'classnames';
import * as _ from 'lodash';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom-v5-compat';
import { Tooltip } from '@patternfly/react-core';
import {
  observer,
  Node,
  NodeModel,
  useHover,
  createSvgIdUrl,
} from '@patternfly/react-topology';
import {
  ApprovalStatus,
  ApprovalTaskKind,
  CustomRunKind,
  K8sResourceKind,
  TaskKind,
} from '../../types';
import { ApprovalTaskModel, CustomRunModelV1Beta1 } from '../../models';
import {
  getApprovalStatus,
  getApprovalStatusInfo,
} from '../utils/pipeline-approval-utils';
import { truncateMiddle } from './truncate-middle';
import SvgDropShadowFilter from './SvgDropShadowFilter';
import {
  WatchK8sResults,
  getGroupVersionKindForModel,
  useK8sWatchResources,
} from '@openshift-console/dynamic-plugin-sdk';
import { ApprovalStatusIcon } from './StatusIcons';
import { TaskNodeModelData } from './types';

import './CustomTaskNode.scss';

type ApprovalTaskNodeProps = {
  element: Node<NodeModel, TaskNodeModelData>;
  disableTooltip?: boolean;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export type WatchResource = {
  [key: string]: ApprovalTaskKind & CustomRunKind;
};

interface ApprovalTaskComponentProps {
  pipelineRunName?: string;
  name: string;
  loaded?: boolean;
  task?: {
    data: TaskKind;
  };
  status: ApprovalStatus;
  namespace: string;
  disableVisualizationTooltip?: boolean;
  width: number;
  height: number;
  customTask?: K8sResourceKind;
}

const FILTER_ID = 'SvgTaskDropShadowFilterId';

const ApprovalTaskComponent: React.FC<ApprovalTaskComponentProps> = ({
  pipelineRunName,
  namespace,
  task,
  status,
  name,
  disableVisualizationTooltip,
  width,
  height,
  customTask,
}) => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  const showStatusState = !!pipelineRunName;
  const visualName = name || _.get(task, ['metadata', 'name'], '');
  const nameRef = React.useRef();
  const pillRef = React.useRef();

  const path = customTask?.metadata?.name
    ? `/dev-pipelines/ns/${namespace}/approvals?name=${customTask?.metadata?.name}`
    : undefined;

  const enableLogLink = status !== ApprovalStatus.Idle && !!path;
  const taskStatusColor = status
    ? getApprovalStatusInfo(status).pftoken.value
    : getApprovalStatusInfo(ApprovalStatus.Idle).pftoken.value;

  const [hover, hoverRef] = useHover();
  const truncatedVisualName = React.useMemo(
    () =>
      truncateMiddle(visualName, {
        length: showStatusState ? 11 : 14,
        truncateEnd: true,
      }),
    [visualName, showStatusState],
  );

  const renderVisualName = (
    <text
      ref={nameRef}
      x={showStatusState ? 30 : width / 2}
      y={height / 2 + 1}
      className={classnames('odc-pipeline-vis-task-text', {
        'is-text-center': !pipelineRunName,
        'is-linked': enableLogLink,
      })}
    >
      {truncatedVisualName}
    </text>
  );

  let taskPill = (
    <g ref={hoverRef}>
      <SvgDropShadowFilter dy={1} id={FILTER_ID} />
      <rect
        filter={hover ? createSvgIdUrl(FILTER_ID) : ''}
        width={width}
        height={height}
        rx={5}
        className={classnames('odc-pipeline-vis-task', {
          'is-selected': !!pipelineRunName && hover,
          'is-linked': !!pipelineRunName && enableLogLink,
        })}
        style={{
          stroke: pipelineRunName
            ? status
              ? getApprovalStatusInfo(status).pftoken.value
              : getApprovalStatusInfo(ApprovalStatus.Idle).pftoken.value
            : '',
        }}
      />
      {visualName !== truncatedVisualName && disableVisualizationTooltip ? (
        <Tooltip triggerRef={nameRef} content={visualName}>
          {renderVisualName}
        </Tooltip>
      ) : (
        renderVisualName
      )}

      {showStatusState && (
        <svg
          width={30}
          height={30}
          viewBox="-10 -7 30 30"
          style={{
            color: taskStatusColor,
          }}
        >
          <ApprovalStatusIcon status={status} />
        </svg>
      )}
    </g>
  );

  if (!disableVisualizationTooltip) {
    taskPill = (
      <Tooltip
        triggerRef={pillRef}
        position="bottom"
        enableFlip={false}
        content={t('Approval Task')}
      >
        <g ref={pillRef}>{taskPill}</g>
      </Tooltip>
    );
  }
  return (
    <g
      className={classnames('odc-pipeline-topology__task-node', {
        'is-link': enableLogLink,
      })}
    >
      {enableLogLink ? <Link to={path}>{taskPill}</Link> : taskPill}
    </g>
  );
};

const ApprovalTaskNode: React.FC<ApprovalTaskNodeProps> = ({
  element,
  disableTooltip,
}) => {
  const { height, width } = element.getBounds();

  const { pipeline, pipelineRun, task } = element.getData();

  const customTaskName = `${pipelineRun?.metadata?.name}-${task?.name}`;

  const watchedResources = {
    customRun: {
      groupVersionKind: getGroupVersionKindForModel(CustomRunModelV1Beta1),
      name: customTaskName,
      namespace: pipeline?.metadata?.namespace,
      prop: 'task',
    },
    approvalTask: {
      groupVersionKind: getGroupVersionKindForModel(ApprovalTaskModel),
      name: customTaskName,
      namespace: pipeline?.metadata?.namespace,
      prop: 'task',
    },
  };

  const resourcesData: WatchK8sResults<WatchResource> =
    useK8sWatchResources<WatchResource>(watchedResources);

  const approvalStatus = getApprovalStatus(
    resourcesData.approvalTask?.data,
    pipelineRun,
  );

  const taskComponent: JSX.Element = (
    <ApprovalTaskComponent
      pipelineRunName={pipelineRun?.metadata?.name}
      name={task.name || ''}
      task={task.taskSpec && { data: { spec: task.taskSpec } }}
      namespace={pipeline?.metadata?.namespace}
      status={approvalStatus}
      disableVisualizationTooltip={disableTooltip}
      width={width}
      height={height}
      customTask={resourcesData.approvalTask?.data as ApprovalTaskKind}
    />
  );
  return taskComponent;
};

export default React.memo(observer(ApprovalTaskNode));
