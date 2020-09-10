#!/usr/bin/env node
// https://github.com/SBoudrias/Inquirer.js/#installation
// https://github.com/mokkabonna/inquirer-autocomplete-prompt
//
// Todo
// - Check that mysql command exists
const inquirer = require("inquirer");
const { exec } = require("child_process");
const execSync = require('child_process').execSync;

// Init inquirer.
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

// Import projects.
const projects = require("./projects.js").projects;

/**
 * Filtering function to filter out projects matching input.
 */
const searchProject = (projects, answers, input) => {
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


/**
 * Checks if ssh connection settings are enabled for remote.
 * If they are, use SSH tunnel for pulling database.
 */
const useSSH = project =>
    typeof(project.remote) !== "undefined" && typeof(project.remote.sshHost) !== "undefined";



/**
 * Run all steps importing database.
 */
const doPull = project => {

    // Pull via SSH tunnel.
    if (useSSH(project)) {
        databasePullSSH(project);
    }
    // Pull directly from host
    else {
        databasePull(project);
    }

    databasePushMySQL(project);
    databaseReplaceMySQL(project).then(() => {
        console.log("Replaced");
    }).catch((error) => {
        console.log(error);
    });

}

function databasePull(project) {
  console.log(`Pull database from ${project.remote.dbHost}`);
  let cmd = `mysqldump --column-statistics=0 -u${project.remote.dbUsername} -p${project.remote.dbPassword} --port=${project.remote.dbPort} -h${project.remote.dbHost} ${project.remote.dbName} > ./tmp/dump.sql`;
  let stdout = execSync(cmd, {stdio: "ignore"});
}

function databasePullSSH(project) {
    try {
        console.log(`Pull database via SSH from host ${project.remote.sshHost} from database host ${project.remote.dbHost}`);
        let cmd = `ssh ${project.remote.sshUsername}@${project.remote.sshHost} -o StrictHostKeyChecking=no -p ${project.remote.sshPort} "mysqldump -u${project.remote.dbUsername} -p${project.remote.dbPassword} --port=${project.remote.dbPort} -h${project.remote.dbHost} ${project.remote.dbName}" > ./tmp/dump.sql`;
        let stdout = execSync(cmd, {stdio: "ignore"});
    } catch(e) {
        console.log(e);
    }

}

function databasePushMySQL(project) {
  console.log(`Push database to ${project.local.dbHost}`);
  let cmd = `mysql -u${project.local.dbUsername} -p${project.local.dbPassword} --port=${project.local.dbPort} -h${project.local.dbHost} ${project.local.dbName} < ./tmp/dump.sql`;
  let stdout = execSync(cmd, {stdio: "ignore"});
  // console.log(stdout.toString());
}

function databaseReplaceMySQL(project) {

    return new Promise((resolve, reject) => {


        console.log("Replace domains.");

        // Domain replacements.
        const commands = [
            `mysql  -u${project.local.dbUsername} \
                -p${project.local.dbPassword} \
                --port=${project.local.dbPort} \
                -h${project.local.dbHost} ${project.local.dbName} \
                -e "UPDATE  ${project.local.dbPrefix}options \
                    SET     option_value = replace(option_value, '${project.remote.url}', '${project.local.url}') \
                    WHERE   option_name = 'home' OR option_name = 'siteurl'"`,
            `mysql  -u${project.local.dbUsername} \
                -p${project.local.dbPassword} \
                --port=${project.local.dbPort} \
                -h${project.local.dbHost} ${project.local.dbName} \
                -e "UPDATE  ${project.local.dbPrefix}posts \
                    SET     guid = replace(guid, '${project.remote.url}', '${project.local.url}')"`,
            `mysql  -u${project.local.dbUsername} \
                -p${project.local.dbPassword} \
                --port=${project.local.dbPort} \
                -h${project.local.dbHost} ${project.local.dbName} \
                -e "UPDATE  ${project.local.dbPrefix}posts \
                    SET post_content = replace(post_content, '${project.remote.url}', '${project.local.url}')"`,
            `mysql  -u${project.local.dbUsername} \
                -p${project.local.dbPassword} \
                --port=${project.local.dbPort} \
                -h${project.local.dbHost} ${project.local.dbName} \
                -e "UPDATE  ${project.local.dbPrefix}postmeta \
                    SET     meta_value = replace(meta_value, '${project.remote.url}', '${project.local.url}')"`
        ];

        // Execute commands.
        exec(commands.join(" && "), (err, stdout, stderr) => {
            if (err) {
                reject(stderr);
            } else {
                resolve();
            }
        });
    });

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
        const project = projects[answers.project];
      promptPull(project);
    });
}


/**
 * Confirm before continuing.
 */
function promptPull(project) {

  inquirer
    .prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Pull from remote to local datanase and overwrite existing content?",
      }
    ])
    .then(function(answers) {
        if (answers.confirm) {
            doPull(project);
        }
    });
}

promptProject();
