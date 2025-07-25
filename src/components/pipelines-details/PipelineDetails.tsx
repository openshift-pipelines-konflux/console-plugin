import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { PageSection, Title } from '@patternfly/react-core';

import PipelineVisualization from './PipelineVisualization';
import { ResourceSummary } from '../details-page/details-page';
import DynamicResourceLinkList from '../triggers-details/DynamicResourceLinkList';
import { WorkspaceDefinitionList } from '../pipelines-tasks';
import { PipelineModel, TriggerTemplateModel } from '../../models';
import { PipelineDetailsTabProps } from './types';
import { getPipelineTaskLinks } from './utils';
import TriggerTemplateResourceLink from './TriggerTemplateResourceLink';
import { usePipelineTriggerTemplateNames } from '../utils/triggers';

const PipelineDetails: React.FC<PipelineDetailsTabProps> = ({
  obj: pipeline,
}) => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  const templateNames =
    usePipelineTriggerTemplateNames(
      pipeline?.metadata?.name,
      pipeline?.metadata?.namespace,
    ) || [];

  const { taskLinks, finallyTaskLinks } = getPipelineTaskLinks(pipeline);

  return (
    <>
      <PageSection isFilled variant="light">
        <Title headingLevel="h2">{t('Pipeline details')}</Title>
        <PipelineVisualization pipeline={pipeline} />
        <div className="row">
          <div className="col-sm-6">
            <ResourceSummary resource={pipeline} model={PipelineModel} />
          </div>
          <div className="col-sm-6">
            <TriggerTemplateResourceLink
              namespace={pipeline.metadata.namespace}
              model={TriggerTemplateModel}
              links={templateNames}
            />
            <DynamicResourceLinkList
              namespace={pipeline.metadata.namespace}
              links={taskLinks}
              title={t('Tasks')}
            />
            <DynamicResourceLinkList
              namespace={pipeline.metadata.namespace}
              links={finallyTaskLinks}
              title={t('Finally tasks')}
            />
            <WorkspaceDefinitionList obj={pipeline} />
          </div>
        </div>
      </PageSection>
    </>
  );
};

export default PipelineDetails;
