#!/usr/bin/env node
// https://github.com/SBoudrias/Inquirer.js/#installation
// https://github.com/mokkabonna/inquirer-autocomplete-prompt
//
// Todo
// - Check that mysql command exists
const inquirer = require("inquirer");
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);
const projects = require("./projects.js").projects;

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

function databasePull() {
  "ssh root@ipaddress \"mysqldump -u dbuser -p dbname\" > dblocal.sql";
}

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

function promptSourceEnvironment() {
  inquirer
    .prompt([
      {
        type: "list",
        name: "from",
        message: "Select source environment",
        choices: Object.keys(projects[jobConfig.project])
      }
    ])
    .then(function(answers) {
      Object.assign(jobConfig, answers);
      promptTargetEnvironment();
    });
}

function promptTargetEnvironment() {
  // Filter out source environment. Target can't be the same as source.
  const availableEnvironments = Object.keys(projects[jobConfig.project]).filter(
    environment => environment != jobConfig.from
  );

  inquirer
    .prompt([
      {
        type: "list",
        name: "to",
        message: "Select target environment",
        choices: availableEnvironments
      }
    ])
    .then(function(answers) {
      Object.assign(jobConfig, answers);
      console.log(jobConfig);
    });
}

promptProject();
