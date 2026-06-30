// Local development server.
require("dotenv").config();
const app = require("./app");
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Smart Bus Route Finder API running on http://localhost:${port}`);
  console.log(`Try: http://localhost:${port}/api/health`);
});
