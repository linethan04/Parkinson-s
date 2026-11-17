# scripts/

All R code. Open [@../Parkinson-s.Rproj](../Parkinson-s.Rproj) first so R starts in the repository folder; every path is relative to it.

Install packages once:

```r
install.packages(c("tidyverse", "lmerTest", "patchwork", "ggrepel", "ranger", "ragg", "rmarkdown"))
```

## Files

| File | What it does | Reads | Writes | How to run |
|---|---|---|---|---|
| [@pd_figures.R](pd_figures.R) | Cleans both datasets, builds voice scores, runs Aims 1–4, saves the 13 final figures. | [@../data/parkinsons+telemonitoring/parkinsons_updrs.data](../data/parkinsons+telemonitoring/parkinsons_updrs.data), [@../data/parkinsons.data](../data/parkinsons.data) | [@../output/figures/](../output/figures/) | `source("scripts/pd_figures.R")` (~90 s) |
| [@theme_pd.R](theme_pd.R) | Shared plot theme, colours and `save_fig()` (300 dpi PNG). Not run on its own. | — | — | loaded by `pd_figures.R` |
| [@aims_1_2_slides.R](aims_1_2_slides.R) | Slide-ready Aim 1–2 figures (no titles, slide background). Self-contained. | [@../data/parkinsons+telemonitoring/parkinsons_updrs.data](../data/parkinsons+telemonitoring/parkinsons_updrs.data) | [@../output/slides_aims_1_2/](../output/slides_aims_1_2/) | `source("scripts/aims_1_2_slides.R")` (~20 s) |
| [@PD.PROJECT.Rmd](PD.PROJECT.Rmd) | Jason's data wrangling. Cleans both datasets and explains each step. | both raw data files | `data/pad_clean.csv`, `data/puc_clean.csv`, `data/pad_people.csv` | Knit |
| [@Aims_3_and_4.Rmd](Aims_3_and_4.Rmd) | Aim 3 prediction (mean baseline, linear regression, random forest; random rows vs leave one person out) and Aim 4 PD vs healthy tests. | `data/pad_clean.csv`, `data/puc_clean.csv` | [@../output/aims_3_4/](../output/aims_3_4/) | Knit **after** `PD.PROJECT.Rmd` (a few minutes) |

## Run order

- `pd_figures.R` and `aims_1_2_slides.R` are independent. Run either at any time.
- `PD.PROJECT.Rmd` must be knitted before `Aims_3_and_4.Rmd`.

Both Rmds set `root.dir = ".."`, so knitting from RStudio works with the repository-relative paths.

## Notes

- Seeds are fixed at 2026.
- `aims_1_2_slides.R` uses the font "Avenir Next" (built into macOS). On other systems, change `font` near the top of the script.
- `pd_figures.R` logs jitter, shimmer and NHR before z-scoring. `PD.PROJECT.Rmd` z-scores the raw values. So Aim 4 numbers in [@../output/figures/](../output/figures/) and [@../output/aims_3_4/](../output/aims_3_4/) differ slightly.
