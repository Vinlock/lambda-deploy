const exec = require("shelljs");
const AWS = require('aws-sdk');
const { argv } = require('yargs');
const fs = require('fs');
const zipdir = require('zip-dir');
const colors = require('colors');

const lambda = new AWS.Lambda({
  apiVersion: '2015-03-31',
  region: process.env.AWS_REGION
});

class Deploy {

  constructor() {
    this.handler = argv._[0];
    this.function = argv._[1];
    if (process.env.PREFIX === undefined) {
      this.prefix = `${process.env.PREFIX}-`;
    } else {
      this.prefix = '';
    }
    this.function_name = `${this.prefix}${this.function}`;
    this.verbose = argv.v !== undefined || argv.verbose !== undefined;

    if (this.function === undefined) {
      throw Error('Function name not supplied.');
    } else if (this.handler === undefined) {
      throw Error('Handler not supplied.');
    }
  }

  run() {
    console.log('== '.bold.cyan, `Running ${this.handler} for function ${this.function}...`.blue);
    this[this.handler]();
  }

  deploy() {
    this.removeAwsSdk();
    this.lambdaFunctionExists().then(() => {
      this.lambdaZipUpdate();
    }).catch(() => {
      this.lambdaZipCreate();
    });
  }

  create() {
    fs.mkdirSync(`${this.function}`);
    fs.writeFileSync(`${this.function}/index.js`, "exports.handler = (event, context, callback) => {\n" +
      "    // TODO implement\n" +
      "    callback(null, 'Hello from Lambda');\n" +
      "};");
    fs.writeFileSync(`${this.function}/package.json`, `{
      "name": "${this.function.toLowerCase()}",
      "version": "1.0.0",
      "description": "",
      "main": "index.js",
      "scripts": {
        "test": "echo \\"Error: no test specified\\" && exit 1"
      },
      "license": "MIT",
      "dependencies": {
        "aws-sdk": "^2.205.0"
      },
      "author": ""
    }`);
    let update = execSync(`(cd ${this.function}; yarn)`).output;
  }

  // Private
  removeAwsSdk() {
    console.log('== '.bold.cyan, 'Removing `aws-sdk` via yarn...'.red);
    try {
      let remove = execSync(`(cd ${this.function} && yarn remove aws-sdk)`);
      if (this.verbose) {
        console.log(remove);
      }
    } catch (err) {
      if (this.verbose) {
        console.log(err);
      }
    }
  }

  addAwsSdk() {
    console.log('== '.bold.cyan, 'Installing `aws-sdk` via yarn...'.green);
    try {
      let add = execSync(`(cd ${this.function} && yarn add aws-sdk)`);
      if (this.verbose) {
        console.log(add);
      }
    } catch (err) {
      if (this.verbose) {
        console.log(err);
      }
    }
  }

  addEnvVariables(params) {
    if (argv.hasOwnProperty('env') && argv.env.length > 0) {
      let log = 'Adding environment variables'.green;
      console.log('== '.bold.cyan, log);
      if (this.verbose) {
        console.log(JSON.stringify(argv.env));
      }
      if (!params.hasOwnProperty('Environment')) {
        params.Environment = {};
      }
      params.Environment.Variables = {};

      let verbose = this.verbose;
      let processEnv = function(envString) {
        let env = envString.split("=");
        console.log('==== '.bold.cyan, `Adding env variable: ${env[0]} = ${env[1]}`.cyan);
        params.Environment.Variables[env[0]] = env[1];
      };

      if (typeof argv.env === "string") {
        processEnv(argv.env);
      } else if (Array.isArray(argv.env)) {
        for (let i in argv.env) {
          if (argv.env.hasOwnProperty(i)) {
            processEnv(argv.env[i]);
          }
        }
      }
    } else {
      console.log('== '.bold.cyan, 'No environment variables set... Ignoring...'.red);
    }
    return params;
  }

  /**
   * Check if lambda function exists.
   * If resolves, it exists.
   * If it rejects, it does not exist.
   *
   * @returns {Promise}
   */
  lambdaFunctionExists() {
    return new Promise((res, rej) => {
      lambda.getFunction({
        FunctionName: `${this.function_name}`
      }, (err, data) => {
        if (err) {
          let log = `Lambda function ${this.function_name} does not exist, creating...`.red;
          console.log('== '.bold.cyan, log);
          console.log(err);
          rej();
        } else {
          let log = `Lambda function ${this.function_name} exists, updating...`.green;
          console.log('== '.bold.cyan, log);
          if (this.verbose) {
            console.log(data);
          }
          res();
        }
      });
    });
  }

  /**
   * Zip and Update Lambda Code / Function
   */
  lambdaZipUpdate() {
    console.log('== '.bold.cyan, `Zipping up ${this.function_name} function...`.green.bold);
    zipdir(this.function, (err, buffer) => {
      console.log('== '.bold.cyan, `${this.function_name} zipped.`.green);

      // Run update function call.
      console.log('== '.bold.cyan, `Updating ${this.function_name} function code...`.green.bold);
      // Update Code Params
      let updateParams = {
        FunctionName: `${this.function_name}`,
        Publish: true,
        ZipFile: buffer
      };
      if (this.verbose) {
        console.log(updateParams);
      }
      lambda.updateFunctionCode(updateParams, (err, data) => {
        if (err) {
          let log = 'Lambda Code Update Error'.red.bold;
          console.log('== '.bold.cyan, log);
          console.log(err);
        } else {
          let log = 'Lambda Code Updated'.green.bold;
          console.log('== '.bold.cyan, log);
          if (this.verbose) {
            console.log(err);
          }
          // Update config params.
          let updateConfigParams = {
            FunctionName: `${this.function_name}`
          };

          // Check for description
          if (argv.hasOwnProperty('desc') && argv.desc.length > 0) {
            console.log('== '.bold.cyan, 'Adding description...'.green);
            updateConfigParams.Description = argv.desc;
          } else {
            console.log('== '.bold.cyan, 'No description set... Ignoring...'.red);
          }

          // Check for environment variables.
          updateConfigParams = this.addEnvVariables(updateConfigParams);

          console.log('== '.bold.cyan, `Updating ${this.function_name} function configuration...`.green.bold);
          if (this.verbose) {
            console.log(updateConfigParams);
          }
          lambda.updateFunctionConfiguration(updateConfigParams, (err, data) => {
            if (err) {
              let log = 'Lambda Update Config Error'.red.bold;
              console.log('== '.bold.cyan, log, err);
            } else {
              let log = 'Lambda Config Updated'.green.bold;
              console.log('== '.bold.cyan, log);
              if (this.verbose) {
                console.log(data);
              }
            }
            this.addAwsSdk();
          });
        }
      });
    });
  }

  /**
   * Lambda Zip and Create Function
   */
  lambdaZipCreate() {
    console.log('== '.bold.cyan, `Zipping up ${this.function_name} function...`.green.bold);
    zipdir(this.function, (err, buffer) => {
      let params = {
        Code: {
          ZipFile: buffer
        },
        FunctionName: `${this.function_name}`,
        Handler: 'index.handler',
        MemorySize: 128,
        Publish: true,
        Role: "arn:aws:iam::577355045965:role/CryptoLogicLambda",
        Runtime: "nodejs6.10",
        Timeout: 15
      };

      // Check for description
      if (argv.hasOwnProperty('desc') && argv.desc.length > 0) {
        console.log('== '.bold.cyan, 'Adding description...'.green);
        params.Description = argv.desc;
      } else {
        console.log('== '.bold.cyan, 'No description set... Ignoring...'.red);
      }

      // Check for environment variables.
      updateConfigParams = this.addEnvVariables(params);

      // Deploy
      console.log('== '.bold.cyan, `Creating ${this.function_name} function...`.green.bold);
      lambda.createFunction(params, (err, data) => {
        if (err) {
          let log = 'Lambda Create Function Error'.red.bold;
          console.log('== '.bold.cyan, log, err);
        } else {
          let log = 'Lambda Function Created'.green.bold;
          console.log('== '.bold.cyan, log);
          if (this.verbose) {
            console.log(data);
          }
        }
        this.addAwsSdk();
      });
    });
  }

}

module.exports = Deploy;