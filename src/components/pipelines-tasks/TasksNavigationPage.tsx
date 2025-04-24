import React from 'react';
import { useNavigate } from 'react-router-dom-v5-compat';
import { useTranslation } from 'react-i18next';
import {
  HorizontalNav,
  ListPageCreateDropdown,
  ListPageHeader,
  NamespaceBar,
  NavPage,
  useActiveNamespace,
} from '@openshift-console/dynamic-plugin-sdk';
import TasksList from './TasksList';
import TaskRunsList from './TaskRunsList';
import { getReferenceForModel } from '../pipelines-overview/utils';
import { TaskModel, TaskRunModel } from '../../models';
import { ALL_NAMESPACES_KEY, DEFAULT_NAMESPACE } from '../../consts';

import './TasksNavigationPage.scss';

const taskModelRef = getReferenceForModel(TaskModel);
const taskRunModelRef = getReferenceForModel(TaskRunModel);

const TasksNavigationPage = () => {
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  const [activeNamespace] = useActiveNamespace();
  const navigate = useNavigate();

  const createItems = {
    tasks: TaskModel.labelKey || TaskModel.label,
    taskRun: TaskRunModel.labelKey || TaskRunModel.label,
  };

  const onCreate = (type: string) => {
    return type === 'tasks'
      ? navigate(
          `/k8s/ns/${
            activeNamespace === ALL_NAMESPACES_KEY
              ? DEFAULT_NAMESPACE
              : activeNamespace
          }/${taskModelRef}/~new`,
        )
      : navigate(
          `/k8s/ns/${
            activeNamespace === ALL_NAMESPACES_KEY
              ? DEFAULT_NAMESPACE
              : activeNamespace
          }/${taskRunModelRef}/~new`,
        );
  };

  const pages: NavPage[] = [
    {
      href: '',
      name: t('Tasks'),
      component: TasksList,
    },
    {
      href: 'task-runs',
      name: t('TaskRuns'),
      component: TaskRunsList,
    },
  ];

  return (
    <>
      {' '}
      <NamespaceBar></NamespaceBar>
      <ListPageHeader title={t('Tasks')}>
        <ListPageCreateDropdown items={createItems} onClick={onCreate}>
          {t('Create')}
        </ListPageCreateDropdown>
      </ListPageHeader>
      <HorizontalNav pages={pages} />
    </>
  );
};

export default TasksNavigationPage;
