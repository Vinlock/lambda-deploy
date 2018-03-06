const fs = require('fs');
const colors = require('colors');
// const Handlebars = require('handlebars');
const CURRENT_DIR = process.cwd();
const path = require('path');
const appDir = path.dirname(require.main.filename);
const { exec } = require("shelljs");
const { log, error } = require("./helpers");

class Lambda {

  constructor(options) {
    let requiredOptions = [
      'function_name',
      'region',
      'verbose'
    ];

    for (let required in requiredOptions) {
      if (!options.hasOwnProperty(requiredOptions[required])) {
        console.log(`Options parameter "${requiredOptions[required]} required and not given.`.red.bold);
      }
    }

    this.function_name = options.function_name;
    this.function_prefix = options.function_prefix ? options.function_prefix : "";
    this.verbose = options.verbose
  }

  createLambdaBoilerplate() {
    let templatePath = appDir + "/../templates/index.js.hbs";
    console.log(templatePath.bold.red);
    let template = fs.readFileSync(templatePath, "utf8");
    let function_dir = CURRENT_DIR + "/" + this.function_name;

    log(`Checking if ${function_dir} directory exists...`.bold);
    if (fs.existsSync(function_dir)) {
      error(`Directory under the name ${this.function_name} already exists.`, true);
    }

    fs.mkdirSync(function_dir);
    log(`Directory created.`.green.bold);

    fs.writeFileSync(`${function_dir}/index.js`, template);
    log(`Created ${function_dir}/index.js from template.`.green.bold);

    fs.writeFileSync(`${function_dir}/package.json`, JSON.stringify({
      name: this.function_name.toLowerCase(),
      version: "",
      description: "",
      main: "index.js",
      license: "MIT",
      dependencies: {
        "aws-sdk": "^2.205.0"
      }
    }, null, 2));
    log(`Created ${function_dir}/package.json from template.`.green.bold);

    log("Installing yarn dependencies...".bold);
    let update = exec(`(cd ${CURRENT_DIR}/${this.function_name}; yarn)`, {silent: true});
    log("Installed yarn dependencies.".green.bold);
    if (this.verbose) console.log(update);
  }

}

module.exports = Lambda;