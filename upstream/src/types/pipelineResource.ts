import { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

export type PipelineResourceKind = K8sResourceCommon & {
  spec: {
    params: { name: string; value: string }[];
    type: string;
  };
};
