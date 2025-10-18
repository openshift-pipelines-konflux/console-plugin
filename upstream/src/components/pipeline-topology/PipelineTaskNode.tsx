import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@patternfly/react-core';
import {
  DEFAULT_LAYER,
  DEFAULT_WHEN_OFFSET,
  Layer,
  Node,
  ScaleDetailsLevel,
  TaskNode,
  TOP_LAYER,
  useDetailsLevel,
  useHover,
  WhenDecorator,
  WithContextMenuProps,
  WithSelectionProps,
} from '@patternfly/react-topology';
import classNames from 'classnames';
import { observer } from 'mobx-react';
import { Link } from 'react-router-dom-v5-compat';
import { NodeType } from './const';
import { PipelineRunModel, TaskModel } from '../../models';
import { getReferenceForModel } from '../pipelines-overview/utils';
import { useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { ComputedStatus, TaskKind } from '../../types';
import { pipelineRunFilterReducer } from '../utils/pipeline-filter-reducer';
import {
  createStepStatus,
  StepStatus,
} from '../pipelines-details/pipeline-step-utils';
import { PipelineVisualizationStepList } from '../pipelines-details/PipelineVisualizationStepList';
import { resourcePathFromModel } from '../utils/utils';
import { getTooltipContent } from './utils';
import './PipelineTaskNode.scss';

type PipelineTaskNodeProps = {
  element: Node;
} & WithContextMenuProps &
  WithSelectionProps;

const PipelineTaskNode: React.FunctionComponent<PipelineTaskNodeProps> = ({
  element,
  onContextMenu,
  contextMenuOpen,
  ...rest
}) => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  const data = element.getData();
  const [hover, hoverRef] = useHover();
  const taskRef = React.useRef();
  const detailsLevel = useDetailsLevel();
  const isFinallyTask = element.getType() === NodeType.FINALLY_NODE;
  let resources;
  if (data.task?.taskRef?.resolver === 'cluster') {
    const taskName = data.task.taskRef?.params?.find(
      (param) => param.name === 'name',
    )?.value;
    const taskNamespace = data.task.taskRef?.params?.find(
      (param) => param.name === 'namespace',
    )?.value;

    resources = {
      kind: getReferenceForModel(TaskModel),
      name: taskName,
      namespace: taskNamespace || data.pipeline.metadata.namespace,
      prop: 'task',
    };
  } else if (data.task?.taskRef) {
    resources = {
      kind: getReferenceForModel(TaskModel),
      name: data.task.taskRef.name,
      namespace: data.pipeline.metadata.namespace,
      prop: 'task',
    };
  }
  const [task] = useK8sWatchResource<TaskKind>(resources);

  const computedTask = task && Object.keys(task).length ? task : data.task;
  const stepList =
    computedTask?.status?.steps ||
    computedTask?.spec?.steps ||
    computedTask?.taskSpec?.steps ||
    [];

  const pipelineRunStatus =
    data.pipelineRun && pipelineRunFilterReducer(data.pipelineRun);
  const isSkipped = !!(
    computedTask &&
    data.pipelineRun?.status?.skippedTasks?.some(
      (t) => t.name === data.task.name,
      (t) => t.name === computedTask.name,
    )
  );

  const taskStatus = data.task?.status || {
    duration: '',
    reason: ComputedStatus.Idle,
  };
  if (
    pipelineRunStatus === ComputedStatus.Failed ||
    pipelineRunStatus === ComputedStatus.Cancelled
  ) {
    if (
      data.task?.status?.reason === ComputedStatus.Idle ||
      data.task?.status?.reason === ComputedStatus.Pending
    ) {
      taskStatus.reason = ComputedStatus.Cancelled;
    }
  }
  if (isSkipped) {
    taskStatus.reason = ComputedStatus.Skipped;
  }

  const stepStatusList: StepStatus[] = stepList.map((step) =>
    createStepStatus(step, taskStatus),
  );
  const { pipelineRun } = data;
  const succeededStepsCount = stepStatusList.filter(
    ({ status }) => status === ComputedStatus.Succeeded,
  ).length;

  const badge =
    stepStatusList.length > 0 && data.status
      ? `${succeededStepsCount}/${stepStatusList.length}`
      : null;

  const passedData = React.useMemo(() => {
    const newData = { ...data };
    Object.keys(newData).forEach((key) => {
      if (newData[key] === undefined) {
        delete newData[key];
      }
    });
    return newData;
  }, [data]);

  const hasTaskIcon = !!(data.taskIconClass || data.taskIcon);
  const tooltipContent = getTooltipContent(data.task?.status?.reason, t);
  const whenDecorator = data.whenStatus ? (
    <WhenDecorator
      element={element}
      status={data.whenStatus}
      leftOffset={
        hasTaskIcon
          ? DEFAULT_WHEN_OFFSET + (element.getBounds().height - 4) * 0.75
          : DEFAULT_WHEN_OFFSET
      }
      toolTip={tooltipContent}
    />
  ) : null;

  // eslint-disable-next-line no-unsafe-optional-chaining
  const { name: plrName, namespace } = pipelineRun?.metadata;
  const path = plrName
    ? `${resourcePathFromModel(
        PipelineRunModel,
        plrName,
        namespace,
      )}/logs?taskName=${element.getLabel()}`
    : undefined;

  const enableLogLink =
    data.status !== ComputedStatus.Idle &&
    data.status !== ComputedStatus.Pending &&
    data.status !== ComputedStatus.Cancelled &&
    data.status !== ComputedStatus.Skipped &&
    !!path;

  const taskNode = (
    <TaskNode
      className="odc-pipeline-topology__task-node"
      element={element}
      onContextMenu={data.showContextMenu ? onContextMenu : undefined}
      contextMenuOpen={contextMenuOpen}
      scaleNode={
        (hover || contextMenuOpen) && detailsLevel !== ScaleDetailsLevel.high
      }
      hideDetailsAtMedium
      {...passedData}
      {...rest}
      badge={badge}
      truncateLength={element.getData()?.label?.length}
    >
      {whenDecorator}
    </TaskNode>
  );

  const classes = classNames('odc-pipeline-topology__task-node', {
    'is-link': enableLogLink,
  });
  return (
    <Layer
      id={
        detailsLevel !== ScaleDetailsLevel.high && (hover || contextMenuOpen)
          ? TOP_LAYER
          : DEFAULT_LAYER
      }
    >
      <g
        data-test={`task ${element.getLabel()}`}
        className={classes}
        ref={hoverRef}
      >
        <Tooltip
          enableFlip={true}
          triggerRef={taskRef}
          content={
            <PipelineVisualizationStepList
              isSpecOverview={!data.status}
              taskName={element.getLabel()}
              steps={stepStatusList}
              isFinallyTask={isFinallyTask}
            />
          }
        >
          <g ref={taskRef}>
            {enableLogLink ? <Link to={path}>{taskNode}</Link> : taskNode}
          </g>
        </Tooltip>
      </g>
    </Layer>
  );
};

export default React.memo(observer(PipelineTaskNode));
