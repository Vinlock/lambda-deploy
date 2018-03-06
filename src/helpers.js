
let log = (message) => {
  console.log("== ".cyan.bold, message);
};

let error = (message, exit = false) => {
  console.log("== ".cyan.bold, message.red.bold);
  if (exit) {
    process.exit(1);
  }
};

module.exports = {
  log, error
};