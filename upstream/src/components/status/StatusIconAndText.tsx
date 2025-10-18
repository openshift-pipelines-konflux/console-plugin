import * as React from 'react';
import classNames from 'classnames';
import {
  CamelCaseWrap,
  StatusComponentProps,
} from '@openshift-console/dynamic-plugin-sdk';
import '../styles/common.scss';

type StatusIconAndTextProps = StatusComponentProps & {
  icon?: React.ReactElement;
  spin?: boolean;
};

/**
 * Component for displaying a status icon and text
 * @param {string} [title] - (optional) status text
 * @param {boolean} [iconOnly] - (optional) if true, only displays icon
 * @param {boolean} [noTooltip] - (optional) if true, tooltip won't be displayed
 * @param {string} [className] - (optional) additional class name for the component
 * @param {React.ReactElement} [icon] - (optional) icon to be displayed
 * @param {boolean} [spin] - (optional) if true, icon rotates
 * @example
 * ```tsx
 * <StatusIconAndText title={title} icon={renderIcon} />
 * ```
 */
const StatusIconAndText: React.FC<StatusIconAndTextProps> = ({
  icon,
  title,
  spin,
  iconOnly,
  noTooltip,
  className,
}) => {
  if (!title) {
    return <>{'-'}</>;
  }

  return (
    <span
      className={classNames('co-icon-and-text', className)}
      title={iconOnly && !noTooltip ? title : undefined}
    >
      {icon &&
        React.cloneElement(icon, {
          className: classNames(
            spin && 'pipelines-console-plugin__spin',
            icon.props.className,
            !iconOnly && 'co-icon-and-text__icon co-icon-flex-child',
          ),
        })}
      {!iconOnly && <CamelCaseWrap value={title} dataTest="status-text" />}
    </span>
  );
};

export default StatusIconAndText;
