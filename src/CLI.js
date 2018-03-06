const { argv } = require('yargs');
const colors = require('colors');
const semver = require('semver');
const { engines, version : appVersion } = require('../package');
const Lambda = require('../src/Lambda');
const inquirer = require('inquirer');
const shell = require("shelljs");
const appConfig = require("../config");
const Config = require("../src/Config");
const { error, log } = require("../src/helpers");
const fs = require("fs");
const CURRENT_DIR = process.cwd();

class CLI {

  constructor() {
    this.checkNodeVersion();
    this.checkYarnVersion();
  }

  run () {
    this.arguments = argv;
    this.parseCommand();
  }

  parseCommand() {
    // Check if user is asking for only version
    if (this.getArgument('v') || this.getArgument('version')) {
      console.log('v' + appVersion);
    } else {
      log(`Lambda Deployment Tool: v${appVersion}`.cyan.bold);
      // Run Command
      let verbose = this.getArgument('vvv') !== undefined || this.getArgument('verbose') !== undefined;
      let command = this.getArgument(0);
      switch (command) {
        case "init":
          new Config();
          break;
        case "create":
          let config = new Config();
          let questions = [];
          let function_name = this.getArgument(1);
          if (function_name === undefined) {
            let function_name_question = {
              type: "input",
              name: "function_name",
              message: "Name of Function",
              default: "myFunFunction",
              validate: (value) => {
                let function_dir = CURRENT_DIR + "/" + value;
                if (fs.existsSync(function_dir)) {
                  return `Directory under the name ${value} already exists.`;
                }
                return true;
              }
            };
            questions.push(function_name_question);
          }

          let prefix = this.getArgument('prefix');
          if (prefix === undefined) {
            let prefix_question = {
              type: "input",
              name: "prefix",
              message: "Lambda Function Name Prefix?",
              suffix: "\nUsed only to name the lambda function within AWS.\n",
              default: (config.get().defaults === undefined || config.get().defaults.function_prefix === undefined) ? "null" : config.get().defaults.function_prefix,
              filter: (value) => {
                return (value === "null") ? undefined : value;
              }
            };
            questions.push(prefix_question);
          }

          let aws_region = this.getArgument('region');
          if (aws_region === undefined) {
            let region_question = {
              type: "list",
              name: "region",
              message: "AWS Region?",
              choices: appConfig.aws.regions,
              default: (config.get().defaults === undefined || config.get().defaults.aws_region === undefined) ? null : config.get().defaults.aws_region,
              pageSize: appConfig.aws.regions.length
            };
            questions.push(region_question);
          }

          if (questions.length > 0) {
            questions.push({
              type: 'confirm',
              name: 'saveAsDefaults',
              message: 'Save your settings as defaults?',
              default: false
            });
          }

          inquirer.prompt(questions).then(answers => {
            console.log(answers);
            if (answers.saveAsDefaults) {
              config.set("function_prefix", answers.prefix || prefix, "defaults");
              config.set("aws_region", answers.region || aws_region, "defaults");
              config.save();
            }
            let lambda = new Lambda({
              function_name: answers.function_name || function_name,
              function_prefix: answers.prefix || prefix,
              region: answers.region || aws_region,
              verbose: verbose
            });
            lambda.createLambdaBoilerplate();
          }).catch((err) => {
            console.log(err);
          });
          break;
        default:
          error(`Error ${command} command not found.`, true);
      }
    }
  }

  getArgument(arg) {
    if (isNaN(arg)) {
      return argv[arg];
    } else {
      return argv._[arg];
    }
  }

  checkNodeVersion() {
    const version = engines.node.trim();
    if (!semver.satisfies(process.version.trim(), version)) {
      console.log(`Required node version ${version} not satisfied with current version ${process.version}.`.red.bold);
      process.exit(1);
    }
  }

  checkYarnVersion() {
    const yarnVersion = engines.yarn.trim();
    const currentYarnVersion = shell.exec("yarn -v", {silent: true}).trim();
    if (!semver.satisfies(currentYarnVersion, yarnVersion)) {
      console.log(`Required yarn version ${yarnVersion} not satisfied with current version ${currentYarnVersion}.`.red.bold);
      process.exit(1);
    }
  }

}

module.exports = CLI;