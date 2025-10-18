import * as React from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import { map } from 'lodash';
import { useTranslation } from 'react-i18next';
import { useFlag } from '@openshift-console/dynamic-plugin-sdk';
import { formatPrometheusDuration, parsePrometheusDuration } from './dateTime';
import { TimeRangeOptions, TimeRangeOptionsK8s } from './utils';
import { FLAG_PIPELINE_TEKTON_RESULT_INSTALLED } from '../../consts';

interface TimeRangeDropdownProps {
  timespan: number;
  setTimespan: (t: number) => void;
}

const TimeRangeDropdown: React.FC<TimeRangeDropdownProps> = ({
  timespan,
  setTimespan,
}) => {
  const [isOpen, setValue] = React.useState(false);
  const toggleIsOpen = React.useCallback(() => setValue((v) => !v), []);
  const setClosed = React.useCallback(() => setValue(false), []);
  const onChange = React.useCallback(
    (v: string) => setTimespan(parsePrometheusDuration(v)),
    [setTimespan],
  );
  const { t } = useTranslation('plugin__pipelines-console-plugin');
  const isTektonResultEnabled = useFlag(FLAG_PIPELINE_TEKTON_RESULT_INSTALLED);

  const timeRangeOptions = isTektonResultEnabled
    ? TimeRangeOptions()
    : TimeRangeOptionsK8s();
  return (
    <div className="form-group">
      <label>{t('Time Range')}</label>
      <div>
        <Dropdown
          className="pipeline-overview__variable-dropdown"
          isOpen={isOpen}
          onOpenChange={(isOpen: boolean) => setValue(isOpen)}
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle ref={toggleRef} onClick={toggleIsOpen}>
              {timeRangeOptions[formatPrometheusDuration(timespan)]}
            </MenuToggle>
          )}
        >
          <DropdownList>
            {map(timeRangeOptions, (name, key) => (
              <DropdownItem
                component="button"
                key={key}
                onClick={() => {
                  onChange(key);
                  setClosed();
                }}
              >
                {name}
              </DropdownItem>
            ))}
          </DropdownList>
        </Dropdown>
      </div>
    </div>
  );
};

export default TimeRangeDropdown;
