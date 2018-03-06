const fs = require("fs");
const CURRENT_DIR = process.cwd();
const appConfig = require("../config");

class Config {

  constructor() {
    this.configLocation = CURRENT_DIR + "/" + appConfig.config.location;
    if (!this.configExists()) {
      this.createFreshConfigFile();
    }
    this.config = JSON.parse(fs.readFileSync(this.configLocation));
  }

  toString() {
    return JSON.stringify(this.config);
  }

  configExists() {
    return fs.existsSync(this.configLocation);
  }

  createFreshConfigFile() {
    console.log(this.configLocation);
    fs.writeFileSync(this.configLocation, JSON.stringify({}))
  }

  set(key, value, namespace = null) {
    if (namespace !== null) {
      if (!this.config.hasOwnProperty(namespace)) {
        this.config[namespace] = {};
      }
      this.config[namespace][key] = value;
    } else {
      this.config[key] = value;
    }
  }

  get() {
    return this.config;
  }

  save() {
    fs.writeFileSync(this.configLocation, this.toString());
  }

}

module.exports = Config;