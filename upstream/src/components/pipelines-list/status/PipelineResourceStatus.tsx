import Status from '@openshift-console/dynamic-plugin-sdk/lib/app/components/status/Status';
import * as React from 'react';

type PipelineResourceStatusProps = {
  status: string;
  children?: React.ReactNode;
  title?: string;
};
const PipelineResourceStatus: React.FC<PipelineResourceStatusProps> = ({
  status,
  children,
  title,
}) => (
  <Status status={status} title={title}>
    {status === 'Failed' &&
      React.Children.toArray(children).length > 0 &&
      children}
  </Status>
);

export default PipelineResourceStatus;
