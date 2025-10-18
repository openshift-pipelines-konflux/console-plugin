import { detailsPage } from '../../../../../tests/views/details-page';
import { operators } from '../../constants/global';
import { pageTitle } from '../../constants/pageTitle';
import { operatorsPO } from '../../page-objects/operators-po';
import { app, projectNameSpace } from '../app';
import { operatorsPage } from '../operators-page';

export const createKnativeServing = () => {
  projectNameSpace.selectProject('knative-serving');
  cy.get('body').then(($body) => {
    if ($body.find(operatorsPO.installOperators.search)) {
      /* eslint-disable-next-line cypress/unsafe-to-chain-command */
      cy.get(operatorsPO.installOperators.search)
        .clear()
        .type(operators.ServerlessOperator);
    }
  });
  cy.get(operatorsPO.installOperators.knativeServingLink).click({
    force: true,
  });
  cy.get('body').then(($body) => {
    if ($body.text().includes('Page Not Found')) {
      cy.reload();
    }
  });
  detailsPage.titleShouldContain(pageTitle.KnativeServings);
  app.waitForLoad();
  cy.get('body').then(($body) => {
    if ($body.find('[role="grid"]').length > 0) {
      cy.log(`${pageTitle.KnativeServings} already subscribed`);
    } else {
      cy.byTestID('item-create').click();
      detailsPage.titleShouldContain(pageTitle.CreateKnativeServing);
      cy.byTestID('create-dynamic-form').click();
      cy.byLegacyTestID('details-actions').should('be.visible');
      cy.contains(
        'DependenciesInstalled, DeploymentsAvailable, InstallSucceeded, Ready, VersionMigrationEligible',
        { timeout: 150000 },
      ).should('be.visible');
    }
  });
};

export const createKnativeEventing = () => {
  projectNameSpace.selectProject('knative-eventing');
  cy.get('body').then(($body) => {
    if ($body.find(operatorsPO.installOperators.search)) {
      /* eslint-disable-next-line cypress/unsafe-to-chain-command */
      cy.get(operatorsPO.installOperators.search)
        .clear()
        .type(operators.ServerlessOperator);
    }
  });
  cy.get(operatorsPO.installOperators.knativeEventingLink).click({
    force: true,
  });
  cy.get('body').then(($body) => {
    if ($body.text().includes('Page Not Found')) {
      cy.reload();
    }
  });
  detailsPage.titleShouldContain(pageTitle.KnativeEventings);
  app.waitForLoad();
  cy.get('body').then(($body) => {
    if ($body.find('[role="grid"]').length > 0) {
      cy.log(`${pageTitle.KnativeEventings} already subscribed`);
    } else {
      cy.byTestID('item-create').click();
      detailsPage.titleShouldContain(pageTitle.CreateKnativeEventing);
      cy.byTestID('create-dynamic-form').click();
      cy.byLegacyTestID('details-actions').should('be.visible');
      cy.contains(
        'DependenciesInstalled, DeploymentsAvailable, InstallSucceeded, Ready, VersionMigrationEligible',
        { timeout: 150000 },
      ).should('be.visible');
    }
  });
};

export const createKnativeKafka = () => {
  operatorsPage.navigateToInstallOperatorsPage();
  projectNameSpace.selectProject('knative-eventing');
  cy.get('body').then(($body) => {
    if ($body.find(operatorsPO.installOperators.search)) {
      /* eslint-disable-next-line cypress/unsafe-to-chain-command */
      cy.get(operatorsPO.installOperators.search)
        .clear()
        .type(operators.ServerlessOperator);
    }
  });
  cy.get(operatorsPO.installOperators.knativeKafkaLink).click({ force: true });
  cy.get('body').then(($body) => {
    if ($body.text().includes('Page Not Found')) {
      cy.reload();
    }
  });
  detailsPage.titleShouldContain(pageTitle.KnativeKafka);
  app.waitForLoad();
  cy.get('body').then(($body) => {
    if ($body.find('[role="grid"]').length > 0) {
      cy.log(`${pageTitle.KnativeKafka} already subscribed`);
    } else {
      cy.byTestID('item-create').click();
      detailsPage.titleShouldContain(pageTitle.CreateKnativeKafka);
      cy.get('#root_spec_source_accordion-toggle').click();
      cy.get('#root_spec_source_enabled').click();
      cy.get('#root_spec_sink_accordion-toggle').click();
      cy.get('#root_spec_sink_enabled').click();
      cy.byTestID('create-dynamic-form').click();

      cy.byLegacyTestID('details-actions').should('be.visible');
      cy.contains('InstallSucceeded', { timeout: 150000 }).should('be.visible');
    }
  });
};

export const createKnativeServingUsingCLI = (retries = 3) => {
  const namespace = 'knative-serving';
  const yamlFile = './cypress/testData/knative-serving.yaml';
  cy.exec(`oc apply -f ${yamlFile} -n ${namespace}`, {
    failOnNonZeroExit: false,
  }).then(function (result) {
    cy.log(result.stdout || result.stderr);
    if (result.stderr) {
      if (retries === 0) {
        throw new Error(result.stderr);
      }
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(20000);
      createKnativeServingUsingCLI(retries - 1);
    }
  });
};

export const createKnativeEventingUsingCLI = (retries = 3) => {
  const namespace = 'knative-eventing';
  const yamlFile = './cypress/testData/knative-eventing.yaml';
  cy.exec(`oc apply -f ${yamlFile} -n ${namespace}`, {
    failOnNonZeroExit: false,
  }).then(function (result) {
    cy.log(result.stdout || result.stderr);
    if (result.stderr) {
      if (retries === 0) {
        throw new Error(result.stderr);
      }
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(20000);
      createKnativeEventingUsingCLI(retries - 1);
    }
  });
};

export const createKnativeKafkaUsingCLI = (retries = 3) => {
  const namespace = 'knative-eventing';
  const yamlFile = './cypress/testData/knative-kafka.yaml';
  cy.exec(`oc apply -f ${yamlFile} -n ${namespace}`, {
    failOnNonZeroExit: false,
  }).then(function (result) {
    cy.log(result.stdout || result.stderr);
    if (result.stderr) {
      if (retries === 0) {
        throw new Error(result.stderr);
      }
      // eslint-disable-next-line cypress/no-unnecessary-waiting
      cy.wait(20000);
      createKnativeKafkaUsingCLI(retries - 1);
    }
  });
};
