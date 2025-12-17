//backend/.eslintrc.cjs

module.exports = {
  env: {
    node: true,
    es2022: true
  },
  plugins: ["import"],
  rules: {
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "always",
        ts: "never"
      }
    ]
  }
};
