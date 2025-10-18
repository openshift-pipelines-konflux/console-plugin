import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { useHover } from '@patternfly/react-topology';
import classnames from 'classnames';
import * as _ from 'lodash';
import { useTranslation } from 'react-i18next';

import { BUILDER_NODE_ADD_RADIUS } from './const';
import RemoveNodeDecorator from './RemoveNodeDecorator';
import { KebabOption, NewTaskNodeCallback } from './types';
import { TaskKind } from '../../types';
import { getReferenceForModel } from '../pipelines-overview/utils';
import { getResourceModelFromTaskKind, getTaskName } from '../utils/pipeline-augment';
import { ResourceIcon } from '@openshift-console/dynamic-plugin-sdk';
import { truncateMiddle } from './truncate-middle';

type KeyedKebabOption = KebabOption & { key: string };

const taskToOption = (
  task: TaskKind,
  callback: NewTaskNodeCallback,
): KeyedKebabOption => {
  const { kind } = task;
  const name = getTaskName(task)

  return {
    key: `${name}-${kind}`,
    label: name,
    icon: (
      <ResourceIcon
        kind={getReferenceForModel(getResourceModelFromTaskKind(kind))}
      />
    ),
    callback: () => {
      callback(task);
    },
  };
};

const TaskList: React.FC<any> = ({
  width,
  height,
  listOptions,
  unselectedText,
  onRemoveTask,
  onNewTask,
  onTaskSearch,
}) => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  const triggerRef = React.useRef(null);
  const textRef = React.useRef();
  const [hover, hoverRef] = useHover();

  const options = _.sortBy(
    listOptions.map((task) => taskToOption(task, onNewTask)),
    (o) => o.label,
  );
  const unselectedTaskText = unselectedText || t('Add task');

  const truncatedTaskText = React.useMemo(
    () =>
      truncateMiddle(unselectedTaskText, {
        length: 10,
        truncateEnd: true,
      }),
    [unselectedTaskText],
  );
  const renderText = (
    <text
      x={width / 2}
      y={height / 2 + 1}
      className="odc-task-list-node__render-text"
      ref={textRef}
    >
      {truncatedTaskText}
    </text>
  );

  return (
    <>
      <g
        data-test="task-list"
        ref={hoverRef}
        className="odc-task-list-node__trigger"
        onClick={(e) => {
          e.stopPropagation();
          onTaskSearch(onNewTask);
        }}
      >
        <rect
          ref={triggerRef}
          className={classnames('odc-task-list-node__trigger-background', {
            'is-disabled': options.length === 0,
          })}
          width={width}
          height={height}
        />
        {options.length === 0 ? (
          <text
            className="odc-task-list-node__trigger-disabled"
            x={width / 2}
            y={height / 2 + 1}
          >
            {t('No tasks')}
          </text>
        ) : (
          <g>
            <rect
              className={
                hover
                  ? 'odc-task-list-node__trigger-underline--hover'
                  : 'odc-task-list-node__trigger-underline'
              }
              y={height}
              width={width}
              height={hover ? 2 : 1}
            />

            {onRemoveTask && hover && (
              <g>
                <RemoveNodeDecorator
                  removeCallback={onRemoveTask}
                  x={120}
                  y={BUILDER_NODE_ADD_RADIUS / 4}
                  content={t('Delete task')}
                />
              </g>
            )}
            {unselectedTaskText !== truncatedTaskText ? (
              <Tooltip content={unselectedTaskText} triggerRef={textRef}>
                {renderText}
              </Tooltip>
            ) : (
              renderText
            )}
          </g>
        )}
      </g>
    </>
  );
};
export default TaskList;
