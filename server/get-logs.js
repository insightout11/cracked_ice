const { execSync } = require('child_process');
try {
  const output = execSync('echo "Getting logs..."', {encoding: 'utf8'});
  console.log('Ready to check logs');
} catch(e) {}
