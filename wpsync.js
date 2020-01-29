#!/usr/bin/env node
// https://github.com/SBoudrias/Inquirer.js/#installation
// https://github.com/mokkabonna/inquirer-autocomplete-prompt
//
// Todo
// - Check that mysql command exists
const inquirer = require("inquirer");
const { execSync } = require("child_process");

// Init inquirer.
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

// Import job configuration.
const projects = require("./projects.js").projects;

// Job configuration.
// This object will be filled based on user input.
const jobConfig = {
  project: "",
  source: "",
  destination: ""
};

/**
 * Filtering function to filter out projects matching input.
 */
function searchProject(projects, answers, input) {
  input = input || "";
  return new Promise(function(resolve) {
    setTimeout(function() {
      const projectNames = Object.keys(projects);
      if (input == "") {
        resolve(projectNames);
      } else {
        const filteredProjectNames = projectNames.filter(
          project => project.indexOf(input) != -1
        );
        resolve(filteredProjectNames);
      }
    }, 50);
  });
}

function doSync() {
  databasePullSSH();
  databasePushMySQL();
  databaseReplaceMySQL();
}

function databasePullSSH() {
  console.log(`Pull database from ${jobConfig.project}:${jobConfig.source}`);
  const e = projects[jobConfig.project][jobConfig.source];
  let cmd = `ssh ${e.sshUsername}@${e.sshHost} -o StrictHostKeyChecking=no -p ${e.sshPort} "mysqldump -u${e.dbUsername} -p${e.dbPassword} --port=${e.dbPort} -h${e.dbHost} ${e.dbName}" > ./tmp/dump.sql`;
  let stdout = execSync(cmd);
  // console.log(stdout.toString());
}

function databasePushMySQL() {
  console.log(`Push database to ${jobConfig.project}:${jobConfig.destination}`);
  const e = projects[jobConfig.project][jobConfig.destination];
  let cmd = `mysql -u${e.dbUsername} -p${e.dbPassword} --port=${e.dbPort} -h${e.dbHost} ${e.dbName} < ./tmp/dump.sql`;
  let stdout = execSync(cmd);
  // console.log(stdout.toString());
}

function databaseReplaceMySQL() {
  console.log("Replace domains.");
  const eSource = projects[jobConfig.project][jobConfig.source];
  const e = projects[jobConfig.project][jobConfig.destination];

  let cmd = `mysql -u${e.dbUsername} -p${e.dbPassword} --port=${e.dbPort} -h${e.dbHost} ${e.dbName} -e "UPDATE ${e.dbPrefix}options SET option_value = replace(option_value, '${eSource.url}', '${e.url}') WHERE option_name = 'home' OR option_name = 'siteurl'"`;
  let stdout = execSync(cmd);
  // console.log(stdout.toString());

  cmd = `mysql -u${e.dbUsername} -p${e.dbPassword} --port=${e.dbPort} -h${e.dbHost} ${e.dbName} -e "UPDATE ${e.dbPrefix}posts SET guid = replace(guid, '${eSource.url}', '${e.url}')"`;
  stdout = execSync(cmd);
  // console.log(stdout.toString());

  cmd = `mysql -u${e.dbUsername} -p${e.dbPassword} --port=${e.dbPort} -h${e.dbHost} ${e.dbName} -e "UPDATE ${e.dbPrefix}posts SET post_content = replace(post_content, '${eSource.url}', '${e.url}')"`;
  stdout = execSync(cmd);
  // console.log(stdout.toString());

  cmd = `mysql -u${e.dbUsername} -p${e.dbPassword} --port=${e.dbPort} -h${e.dbHost} ${e.dbName} -e "UPDATE ${e.dbPrefix}postmeta SET meta_value = replace(meta_value, '${eSource.url}', '${e.url}')"`;
  stdout = execSync(cmd);
  // console.log(stdout.toString());
}

/**
 * The 1st UI step. Choose project.
 */
function promptProject() {
  inquirer
    .prompt([
      {
        type: "autocomplete",
        name: "project",
        suggestOnly: false,
        message: "Select project",
        source: (answers, input) => searchProject(projects, answers, input)
      }
    ])
    .then(function(answers) {
      Object.assign(jobConfig, answers);
      promptSourceEnvironment();
    });
}

/**
 * A second UI step. Ask for source environment.
 */
function promptSourceEnvironment() {
  inquirer
    .prompt([
      {
        type: "list",
        name: "source",
        message: "Select source environment",
        choices: Object.keys(projects[jobConfig.project])
      }
    ])
    .then(function(answers) {
      Object.assign(jobConfig, answers);
      promptTargetEnvironment();
    });
}

/**
 * A third UI step. Ask for destination environment.
 */
function promptTargetEnvironment() {
  // Filter out source environment. Target can't be the same as source.
  const availableEnvironments = Object.keys(projects[jobConfig.project]).filter(
    environment => environment != jobConfig.from
  );

  inquirer
    .prompt([
      {
        type: "list",
        name: "destination",
        message: "Select destination environment",
        choices: availableEnvironments
      }
    ])
    .then(function(answers) {
      Object.assign(jobConfig, answers);
      // console.log(jobConfig);
      doSync();
    });
}

promptProject();
