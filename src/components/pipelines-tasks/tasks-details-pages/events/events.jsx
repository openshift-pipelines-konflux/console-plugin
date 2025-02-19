import * as _ from 'lodash-es';
import * as React from 'react';
import classNames from 'classnames';
import * as PropTypes from 'prop-types';
import { Link } from 'react-router-dom-v5-compat';
import { Trans, useTranslation } from 'react-i18next';
import {
  isGroupVersionKind,
  kindForReference,
  referenceFor,
} from '../../../utils/k8s-utils';
import { useFlag } from '@openshift-console/dynamic-plugin-sdk';
import { ResourceLink, Timestamp } from '@openshift-console/dynamic-plugin-sdk';
import { WSFactory } from '@openshift-console/dynamic-plugin-sdk/lib/utils/k8s/ws-factory';
import { apiGroupForReference } from '../../../utils/pipeline-utils';
import { Box, Loading } from '../../../status/status-box';
import { EventModel, NodeModel } from '../../../../models';
import { FLAGS } from '../../../../types';
import { TogglePlay } from './toggle-play';
import { EventStreamList } from './event-stream';
import { watchURL } from '../../../utils/common-utils';
import { resourcePathFromModel } from '../../../utils/utils';
import { namespaceProptype } from './propTypes';

const maxMessages = 500;
const flushInterval = 500;

// We have to check different properties depending on whether events were
// created with the core/v1 events API or the new events.k8s.io API.
const getFirstTime = (event) => event.firstTimestamp || event.eventTime;
export const getLastTime = (event) => {
  const lastObservedTime = event.series ? event.series.lastObservedTime : null;
  return event.lastTimestamp || lastObservedTime || event.eventTime;
};
export const sortEvents = (events) => {
  return _.orderBy(
    events,
    [getLastTime, getFirstTime, 'name'],
    ['desc', 'desc', 'asc'],
  );
};

// Predicate function to filter by event "type" (normal, warning, or all)
export const typeFilter = (eventType, event) => {
  if (eventType === 'all') {
    return true;
  }
  const { type = 'normal' } = event;
  return type.toLowerCase() === eventType;
};

const kindFilter = (reference, { involvedObject }) => {
  if (!reference) {
    return true;
  }
  const kinds = reference.split(',');
  return kinds.some((ref) => {
    if (!isGroupVersionKind(ref)) {
      return involvedObject.kind === ref;
    }
    // Use `referenceFor` to resolve `apiVersion` when missing from `involvedObject`.
    // We need `apiVersion` to get the group.
    const involvedObjectRef = referenceFor(involvedObject);
    if (!involvedObjectRef) {
      return false;
    }
    // Only check the group and kind, not the API version, so that we catch
    // events for the same resource under a different API version.
    return (
      involvedObject.kind === kindForReference(ref) &&
      apiGroupForReference(involvedObjectRef) === apiGroupForReference(ref)
    );
  });
};

const Inner = (props) => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  const { event } = props;
  const {
    involvedObject: obj,
    source,
    message,
    reason,
    series,
    reportingComponent,
  } = event;

  const tooltipMsg = `${reason} (${obj.kind})`;
  const isWarning = typeFilter('warning', event);
  const firstTime = getFirstTime(event);
  const lastTime = getLastTime(event);
  const count = series ? series.count : event.count;
  const canlistNode = useFlag(FLAGS.CAN_LIST_NODE);
  // Events in v1beta1 apiVersion store the information about the reporting component
  // in the 'source.component' field. Events in v1 apiVersion are storing the information
  // in the `reportingComponent` field.
  // Unfortunatelly we cannot determine which field to use based on the apiVersion since
  // v1beta1 is internally converted to v1.
  const component = source.component ? source.component : reportingComponent;

  return (
    <div
      className={classNames('co-sysevent', {
        'co-sysevent--warning': isWarning,
      })}
      data-test={isWarning ? 'event-warning' : 'event'}
    >
      <div className="co-sysevent__icon-box">
        <i className="co-sysevent-icon" title={tooltipMsg} />
        <div className="co-sysevent__icon-line" />
      </div>
      <div className="co-sysevent__box" role="gridcell">
        <div className="co-sysevent__header">
          <div className="co-sysevent__subheader">
            <ResourceLink
              className="co-sysevent__resourcelink"
              kind={referenceFor(obj)}
              namespace={obj.namespace}
              name={obj.name}
            />
            {obj.namespace && (
              <ResourceLink
                className="co-sysevent__resourcelink hidden-xs"
                kind="Namespace"
                name={obj.namespace}
              />
            )}
            {lastTime && (
              <Timestamp
                className="co-sysevent__timestamp"
                timestamp={lastTime}
              />
            )}
          </div>
          <div className="co-sysevent__details">
            <small className="co-sysevent__source">
              {component !== 'kubelet' &&
                t('Generated from {{ sourceComponent }}', {
                  sourceComponent: component,
                })}
              {component === 'kubelet' && canlistNode && (
                <Trans ns="plugin__pipelines-console-plugin">
                  Generated from {{ sourceComponent: component }} on{' '}
                  <Link to={resourcePathFromModel(NodeModel, source.host)}>
                    {{ sourceHost: source.host }}
                  </Link>
                </Trans>
              )}
              {component === 'kubelet' &&
                !canlistNode &&
                t('Generated from {{ sourceComponent }} on {{ sourceHost }}', {
                  sourceComponent: component,
                  sourceHost: source.host,
                })}
            </small>
            {count > 1 && firstTime && (
              <Trans ns="plugin__pipelines-console-plugin">
                <small className="co-sysevent__count text-secondary">
                  {{ eventCount: count }} times in the last{' '}
                  <Timestamp
                    timestamp={firstTime}
                    simple={true}
                    omitSuffix={true}
                  />
                </small>
              </Trans>
            )}
            {count > 1 && !firstTime && (
              <Trans ns="plugin__pipelines-console-plugin">
                <small className="co-sysevent__count text-secondary">
                  {{ eventCount: count }} times
                </small>
              </Trans>
            )}
          </div>
        </div>
        <div className="co-sysevent__message">{message}</div>
      </div>
    </div>
  );
};

export const NoEvents = () => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  return (
    <Box className="co-sysevent-stream__status-box-empty">
      <div className="cp-text-align-center cos-status-box__detail">
        {t('No events')}
      </div>
    </Box>
  );
};

export const NoMatchingEvents = ({ allCount }) => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  return (
    <Box className="co-sysevent-stream__status-box-empty">
      <div className="cos-status-box__title">{t('No matching events')}</div>
      <div className="cp-text-align-center cos-status-box__detail">
        {allCount >= maxMessages
          ? t('{{count}}+ event exist, but none match the current filter', {
              count: maxMessages,
            })
          : t('{{count}} event exist, but none match the current filter', {
              count: allCount,
            })}
      </div>
    </Box>
  );
};

export const ErrorLoadingEvents = () => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  return (
    <Box>
      <div className="cos-status-box__title cos-error-title">
        {t('Error loading events')}
      </div>
      <div className="cos-status-box__detail cp-text-align-center">
        {t(
          'An error occurred during event retrieval. Attempting to reconnect...',
        )}
      </div>
    </Box>
  );
};

const EventStream = ({
  namespace,
  fieldSelector,
  mock,
  resourceEventStream,
  kind,
  type,
  filter,
  textFilter,
}) => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  const [active, setActive] = React.useState(true);
  const [sortedEvents, setSortedEvents] = React.useState([]);
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const ws = React.useRef(null);

  const filteredEvents = React.useMemo(() => {
    return filterEvents(sortedEvents, { kind, type, filter, textFilter }).slice(
      0,
      maxMessages,
    );
  }, [sortedEvents, kind, type, filter, textFilter]);

  // Handle websocket setup and teardown when dependent props change
  React.useEffect(() => {
    ws.current?.destroy();
    if (!mock) {
      const webSocketID = `${namespace || 'all'}-sysevents`;
      const watchURLOptions = {
        ...(namespace ? { ns: namespace } : {}),
        ...(fieldSelector
          ? {
              queryParams: {
                fieldSelector: encodeURIComponent(fieldSelector),
              },
            }
          : {}),
      };
      const path = watchURL(EventModel, watchURLOptions);
      const webSocketOptions = {
        host: 'auto',
        reconnect: true,
        path,
        jsonParse: true,
        bufferFlushInterval: flushInterval,
        bufferMax: maxMessages,
        subprotocols: undefined,
      };

      ws.current = new WSFactory(webSocketID, webSocketOptions)
        .onbulkmessage((messages) => {
          // Make one update to state per batch of events.
          setSortedEvents((currentSortedEvents) => {
            const topEvents = currentSortedEvents.slice(0, maxMessages);
            const batch = messages.reduce(
              (acc, { object, type: eventType }) => {
                const uid = object.metadata.uid;
                switch (eventType) {
                  case 'ADDED':
                  case 'MODIFIED':
                    if (acc[uid] && acc[uid].count > object.count) {
                      // We already have a more recent version of this message stored, so skip this one
                      return acc;
                    }
                    return { ...acc, [uid]: object };
                  case 'DELETED':
                    return _.omit(acc, uid);
                  default:
                    // eslint-disable-next-line no-console
                    console.error(`UNHANDLED EVENT: ${eventType}`);
                    return acc;
                }
              },
              _.keyBy(topEvents, 'metadata.uid'),
            );
            return sortEvents(batch);
          });
        })
        .onopen(() => {
          setError(false);
          setLoading(false);
        })
        .onclose((evt) => {
          if (evt?.wasClean === false) {
            setError(evt.reason || t('Connection did not close cleanly.'));
          }
        })
        .onerror(() => {
          setError(true);
        });
    }
    return () => {
      ws.current?.destroy();
    };
  }, [namespace, fieldSelector, mock, t]);

  // Pause/unpause the websocket when the active state changes
  React.useEffect(() => {
    if (active) {
      ws.current?.unpause();
    } else {
      ws.current?.pause();
    }
  }, [active]);

  const toggleStream = () => {
    setActive((prev) => !prev);
  };

  const count = filteredEvents.length;
  const allCount = sortedEvents.length;
  const noEvents = allCount === 0;
  const noMatches = allCount > 0 && count === 0;
  let sysEventStatus, statusBtnTxt;

  if (noEvents || mock || (noMatches && resourceEventStream)) {
    sysEventStatus = <NoEvents />;
  }
  if (noMatches && !resourceEventStream) {
    sysEventStatus = <NoMatchingEvents allCount={allCount} />;
  }

  if (error) {
    statusBtnTxt = (
      <span className="co-sysevent-stream__connection-error">
        {_.isString(error)
          ? t('Error connecting to event stream: { error }', {
              error,
            })
          : t('Error connecting to event stream')}
      </span>
    );
    sysEventStatus = <ErrorLoadingEvents />;
  } else if (loading) {
    statusBtnTxt = <span>{t('Loading events...')}</span>;
    sysEventStatus = <Loading />;
  } else if (active) {
    statusBtnTxt = <span>{t('Streaming events...')}</span>;
  } else {
    statusBtnTxt = <span>{t('Event stream is paused.')}</span>;
  }

  const klass = classNames('co-sysevent-stream__timeline', {
    'co-sysevent-stream__timeline--empty': !allCount || !count,
  });
  const messageCount =
    count < maxMessages
      ? t('Showing {{count}} event', { count })
      : t('Showing most recent {{count}} event', { count });

  return (
    <div className="co-m-pane__body">
      <div className="co-sysevent-stream">
        <div className="co-sysevent-stream__status">
          <div className="co-sysevent-stream__timeline__btn-text">
            {statusBtnTxt}
          </div>
          <div
            className="co-sysevent-stream__totals text-secondary"
            data-test="event-totals"
          >
            {messageCount}
          </div>
        </div>

        <div className={klass}>
          <TogglePlay
            active={active}
            onClick={toggleStream}
            className="co-sysevent-stream__timeline__btn"
          />
          <div className="co-sysevent-stream__timeline__end-message">
            {t('Older events are not stored.')}
          </div>
        </div>
        {count > 0 && (
          <EventStreamList events={filteredEvents} EventComponent={Inner} />
        )}
        {sysEventStatus}
      </div>
    </div>
  );
};

EventStream.defaultProps = {
  type: 'all',
  kind: '',
  mock: false,
};

EventStream.propTypes = {
  type: PropTypes.string,
  filter: PropTypes.array,
  kind: PropTypes.string.isRequired,
  mock: PropTypes.bool,
  namespace: namespaceProptype,
  showTitle: PropTypes.bool,
  textFilter: PropTypes.string,
};

const filterEvents = (messages, { kind, type, filter, textFilter }) => {
  // Don't use `fuzzy` because it results in some surprising matches in long event messages.
  // Instead perform an exact substring match on each word in the text filter.
  const words = _.uniq(_.toLower(textFilter).match(/\S+/g)).sort((a, b) => {
    // Sort the longest words first.
    return b.length - a.length;
  });

  const textMatches = (obj) => {
    if (_.isEmpty(words)) {
      return true;
    }
    const name = _.get(obj, 'involvedObject.name', '');
    const message = _.toLower(obj.message);
    return _.every(
      words,
      (word) => name.indexOf(word) !== -1 || message.indexOf(word) !== -1,
    );
  };

  const f = (obj) => {
    if (type && !typeFilter(type, obj)) {
      return false;
    }
    if (kind && !kindFilter(kind, obj)) {
      return false;
    }
    if (filter && !filter.some((flt) => flt(obj.involvedObject, obj))) {
      return false;
    }
    if (!textMatches(obj)) {
      return false;
    }
    return true;
  };

  return _.filter(messages, f);
};

export const ResourceEventStream_ = ({
  obj: {
    kind,
    metadata: { name, namespace, uid },
  },
}) => (
  <EventStream
    fieldSelector={`involvedObject.uid=${uid},involvedObject.name=${name},involvedObject.kind=${kind}`}
    namespace={namespace}
    resourceEventStream
  />
);

export { ResourceEventStream_ as ResourceEventStream };

export const ResourcesEventStream = ({ filters, namespace }) => (
  <EventStream filter={filters} resourceEventStream namespace={namespace} />
);

/**
 * @typedef {import('@console/dynamic-plugin-sdk/src/extensions').ResourceEventStreamProps} ResourceEventStreamProps
 * @augments React.FC<ResourceEventStreamProps>
 */
export const WrappedResourceEventStream = ({ resource }) => (
  <ResourceEventStream_ obj={resource} />
);

export default ResourceEventStream_;
