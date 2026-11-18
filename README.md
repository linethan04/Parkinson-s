Website Link: https://linethan04.github.io/Parkinson-s/

# Voice Measures and Parkinson's Disease Severity

Does a short at-home voice recording show how severe someone's Parkinson's disease (PD) is? We use voice recordings from a six-month telemonitoring trial (42 people with PD) and a second dataset with healthy controls.

## Aims

1. **Voice and UPDRS:** which voice measures (jitter, shimmer, noise) are linked to motor and total UPDRS (mixed-effects models).
2. **Age, sex and UPDRS:** how age and sex relate to motor and total UPDRS.
3. **Prediction:** whether the 11 voice measures predict UPDRS for a new person better than guessing the average.
4. **PD vs healthy:** whether people with PD have worse jitter, shimmer and noise scores than healthy people.

## Data

- [@data/parkinsons+telemonitoring/parkinsons_updrs.data](data/parkinsons+telemonitoring/parkinsons_updrs.data): UCI [Parkinson's Telemonitoring](https://archive.ics.uci.edu/dataset/189/parkinsons+telemonitoring). 5,875 recordings, 42 people with PD, motor and total UPDRS. Aims 1–3.
- [@data/parkinsons.data](data/parkinsons.data): UCI [Parkinsons](https://archive.ics.uci.edu/dataset/174/parkinsons). 195 recordings, 24 PD and 8 healthy people, no UPDRS. Aim 4.

Variable definitions: [@CODEBOOK.md](CODEBOOK.md). More detail: [@data/README.md](data/README.md).

## Repository layout

| Folder | Contents | README |
|---|---|---|
| [@data/](data/) | Raw data (read-only) | [@data/README.md](data/README.md) |
| [@scripts/](scripts/) | All R code | [@scripts/README.md](scripts/README.md) |
| [@output/](output/) | Everything the scripts produce | [@output/README.md](output/README.md) |

## How to reproduce

1. Install R (tested with R 4.5.2 and 4.6.1) and the packages, once:
   ```r
   install.packages(c("tidyverse", "lmerTest", "patchwork", "ggrepel", "ranger", "ragg", "rmarkdown"))
   ```
2. Open [@Parkinson-s.Rproj](Parkinson-s.Rproj) in RStudio. All paths start from this folder.
3. Run the scripts:

| Step | Run | Produces |
|---|---|---|
| Final figures | `source("scripts/pd_figures.R")` (~90 s) | [@output/figures/](output/figures/) |
| Aims 1–2 slides | `source("scripts/aims_1_2_slides.R")` (~20 s) | [@output/slides_aims_1_2/](output/slides_aims_1_2/) |
| Aims 3–4 tables | Knit `scripts/PD.PROJECT.Rmd`, **then** knit `scripts/Aims_3_and_4.Rmd` (a few minutes) | `data/*_clean.csv`, then [@output/aims_3_4/](output/aims_3_4/) |

Steps 1 and 2 are independent of each other and of step 3. Seeds are fixed (2026), so re-runs give the same numbers.

## Main results

- **Aim 1:** 92–93% of UPDRS variation is between people. People with worse voices tend to have higher UPDRS (not significant), but a person's voice changing does not track their UPDRS changing.
- **Aim 2:** about +2.5 motor UPDRS points per decade of age (p = 0.06; total p = 0.035). No sex difference.
- **Aim 3:** for a new person, no voice model beats guessing the average (motor MAE: baseline 7.1, random forest 7.3). With random rows the forest gets 5.9, only because it has already seen each person.
- **Aim 4:** PD voices are worse on all three scores (adjusted p < 0.05), but the groups overlap and there are only 8 healthy people.

**Limitations:** only 42 people, and UPDRS is interpolated between three clinic visits, so recordings from the same person are not independent.

## References

1. GBD 2021 Nervous System Disorders Collaborators. Global burden of disorders affecting the nervous system, 1990–2021. *Lancet Neurol.* 2024.
2. Tsanas A, Little MA, McSharry PE, Ramig LO. Accurate telemonitoring of Parkinson's disease progression by noninvasive speech tests. *IEEE Trans Biomed Eng.* 2010;57(4):884–893.
3. Little MA, McSharry PE, Hunter EJ, Spielman J, Ramig LO. Suitability of dysphonia measurements for telemonitoring of Parkinson's disease. *IEEE Trans Biomed Eng.* 2009;56(4):1015–1022.

## AI usage

We used Claude (Anthropic) to help debug the R code and to build the interactive webpage that presents the final results. All analysis choices and conclusions are ours, and every result can be reproduced by running the scripts in [@scripts/](scripts/).

## Project website

**Open it here: https://linethan04.github.io/Parkinson-s/**

The website is an interactive version of this project: the four aims, charts you can hover over, and the R code behind each result. It works in any browser, with no sign-in or install.

**Offline:** download or clone this repository and double-click [@docs/index.html](docs/index.html). It opens in your browser without internet.

**Where it comes from:** the site's files are in [@docs/](docs/). All its numbers and charts are read from [@docs/data/](docs/data/), which [@scripts/export.R](scripts/export.R) writes from the raw data. To refresh them after changing the analysis, run `Rscript scripts/export.R` from the project folder (needs `jsonlite` as well as the packages above).
