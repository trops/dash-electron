# Algolia SE Tools

Widget package for Algolia Solutions Engineers. All widgets share the workspace `algolia-se-tools-workspace`.

## Widgets

### Data Toolkit

| Widget              | Provider | Description                                                                                                                                                                                               |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DataTransformer** | None     | Convert between CSV, JSON, TSV, NDJSON. Paste or upload data, preview as table, rename columns, set field types (string/number/boolean/auto), export to target format. Publishes `dataTransformed` event. |

> Pair with the existing **AlgoliaExportWidget** (browse/download index) and **AlgoliaBatchManagerWidget** (bulk upload) from the Algolia package for a complete data pipeline.

### Index Analyzer

| Widget                | Provider | Description                                                                                                                                                                                     |
| --------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IndexHealthReport** | Algolia  | Scores an index against 10 best-practice checks across relevance, filtering, UX, performance, and security. Shows pass/warn/fail with actionable recommendations.                               |
| **IndexComparator**   | Algolia  | Side-by-side diff of two indices' settings. Highlights differences in a color-coded table. Great for prod vs staging or before/after audits.                                                    |
| **AttributeExplorer** | Algolia  | Samples records to discover all attributes — types, cardinality, fill rates, null rates, sample values. Configurable sample size (50-1000).                                                     |
| **ConfigRecommender** | Algolia  | Analyzes settings + record structure and generates specific recommendations with exact values to set. Suggests searchable attributes, custom ranking, faceting candidates based on actual data. |

### Demo Builder

| Widget               | Provider | Description                                                                                                                                                                           |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RelevanceTester**  | Algolia  | Run queries, star expected results, get instant relevance metrics (Precision@N, Recall, MRR). Color-coded position matching shows exactly where results land vs where they should be. |
| **SearchPlayground** | Algolia  | Minimal search UI with toggles for typo tolerance, distinct, hits/page, filters, and highlighting. Demo the impact of each relevance lever live.                                      |

## Provider Requirements

-   **DataTransformer**: No provider needed (pure data manipulation)
-   **All other widgets**: Require the Algolia credential provider (`appId` + `apiKey` with admin permissions for settings access)

Configure in Settings > Providers > Add Algolia.

## Suggested Dashboard Layouts

### SE Data Pipeline (1x3 grid)

```
[ DataTransformer ] [ AlgoliaExportWidget ] [ AlgoliaBatchManagerWidget ]
```

### Index Audit (2x2 grid)

```
[ IndexHealthReport  ] [ ConfigRecommender  ]
[ AttributeExplorer  ] [ IndexComparator    ]
```

### Demo & Relevance (1x2 grid)

```
[ RelevanceTester ] [ SearchPlayground ]
```

## MCP Dashboard Creation

Create a dashboard via MCP tools:

```
1. create_dashboard("SE Index Audit", layout: { rows: 2, cols: 2 })
2. add_widget("trops.algolia-se-tools.IndexHealthReport", row: 1, col: 1)
3. add_widget("trops.algolia-se-tools.ConfigRecommender", row: 1, col: 2)
4. add_widget("trops.algolia-se-tools.AttributeExplorer", row: 2, col: 1)
5. add_widget("trops.algolia-se-tools.IndexComparator", row: 2, col: 2)
```

## Tests

107 unit tests across 7 test files covering all utility modules:

-   `dataParser.test.js` — format detection, CSV/TSV/JSON/NDJSON parsing
-   `dataExporter.test.js` — export formats, type casting, CSV escaping
-   `indexHealthScorer.test.js` — all 10 health checks
-   `settingsDiff.test.js` — settings comparison, display formatting
-   `attributeAnalyzer.test.js` — type inference, record analysis
-   `configRecommender.test.js` — recommendation generation
-   `relevanceScorer.test.js` — precision, recall, MRR, position matching

Run: `npx react-scripts test --watchAll=false src/SampleWidgets/AlgoliaSETools/`
