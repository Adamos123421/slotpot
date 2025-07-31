module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    'no-unused-vars': 'warn',
    'no-use-before-define': 'warn'
  }
}; 