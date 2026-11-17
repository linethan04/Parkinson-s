# data/parkinsons+telemonitoring/

UCI [Parkinson's Telemonitoring](https://archive.ics.uci.edu/dataset/189/parkinsons+telemonitoring) dataset (Tsanas et al. 2010). Read-only.

| File | What it is |
|---|---|
| [@parkinsons_updrs.data](parkinsons_updrs.data) | CSV with header. 5,875 rows × 22 columns, no missing values. One row = one home voice recording. 42 people with PD, about 140 recordings each over six months. |
| [@parkinsons_updrs.names](parkinsons_updrs.names) | UCI description file. |

Column definitions: [@../../CODEBOOK.md](../../CODEBOOK.md).

Read by:
- [@../../scripts/pd_figures.R](../../scripts/pd_figures.R)
- [@../../scripts/aims_1_2_slides.R](../../scripts/aims_1_2_slides.R)
- [@../../scripts/PD.PROJECT.Rmd](../../scripts/PD.PROJECT.Rmd)

Note: UPDRS was only measured at baseline, ~3 and ~6 months. Values in between are linearly interpolated.
