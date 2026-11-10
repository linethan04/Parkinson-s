# Voice Measures and Parkinson's Disease Severity

Does a short at-home voice recording reveal how severe someone's Parkinson's disease is? This project uses voice recordings from a six-month telemonitoring trial to find out.

## Background

Parkinson's disease (PD) is the second most common neurodegenerative disease, with about 11.8 million cases worldwide in 2021, up 274% since 1990. PD progression is tracked with the **Unified Parkinson's Disease Rating Scale (UPDRS)**, which requires an in-clinic exam by trained staff. That makes frequent monitoring costly and inconvenient.

Speech impairment is well documented in PD, and dysphonia (voice) measures from sustained vowels can separate people with PD from healthy controls. Tsanas et al. (2009) estimated UPDRS from self-administered home speech tests to within about 7.5 points of clinicians' scores. This project examines how voice measures relate to symptom severity over six months, and whether that accuracy holds up once repeated recordings from the same patient are accounted for.

## Data

[Parkinson's Telemonitoring dataset](https://archive.ics.uci.edu/dataset/189/parkinsons+telemonitoring), UCI Machine Learning Repository:

- 5,875 voice recordings × 22 variables, with no missing values
- 42 patients with early-stage PD, about 140 recordings each, captured automatically at home
- Key variables: jitter and shimmer (pitch and loudness instability), NHR/HNR (noise-to-tonal ratios), `motor_UPDRS`, `total_UPDRS`, `age`, `sex`

See the **[CODEBOOK](CODEBOOK.md)** for a definition of every variable.

## Aims

**Aim 1: voice measures and symptom severity (UPDRS)**
1.1. Determine which voice measures (among the shimmer and jitter variables) are significantly associated with motor and total UPDRS, using mixed-effects models.

**Aim 2: age, sex and symptom severity (UPDRS)**
2.1. Determine how age and sex are associated with motor and total UPDRS.

**Aim 3: predicting UPDRS for a new patient**
3.1. Test whether the 11 voice measures predict motor and total UPDRS for a person the model has never seen, compared with simply guessing the average.

**Aim 4: PD versus healthy voices**
4.1. Using a second dataset with healthy controls ([Parkinsons, UCI](https://archive.ics.uci.edu/dataset/174/parkinsons)), test whether people with PD have worse jitter, shimmer and noise scores than healthy people.

See [Aims 3 and 4](#aims-3-and-4) below for how to run these.

**Overall goal:** show how voice changes track PD severity, and test whether voice alone predicts UPDRS with clinically useful accuracy. The results could be evidence for or against low-cost remote symptom monitoring.

**Limitations:** there are only 42 patients, and UPDRS is linearly interpolated between clinic visits rather than measured at each recording, so recordings from the same patient are not independent.

## Repository structure

<pre>
<a href="./">Parkinson-s/</a>
├── <a href="README.md">README.md</a>                      Project overview (this file)
├── <a href="CODEBOOK.md">CODEBOOK.md</a>                    Variable definitions
├── <a href="Parkinson-s.Rproj">Parkinson-s.Rproj</a>              RStudio project file
├── <a href="data/">data/</a>                          Raw data (read-only)
│   ├── <a href="data/parkinsons+telemonitoring/">parkinsons+telemonitoring/</a>
│   │   ├── <a href="data/parkinsons+telemonitoring/parkinsons_updrs.data">parkinsons_updrs.data</a>      Dataset (CSV)
│   │   └── <a href="data/parkinsons+telemonitoring/parkinsons_updrs.names">parkinsons_updrs.names</a>     UCI description file
│   ├── <a href="data/telemonitoring/">telemonitoring/</a>            Same telemonitoring data (used by Aims 3 and 4)
│   ├── <a href="data/parkinsons.data">parkinsons.data</a>            PD vs healthy dataset (Aim 4)
│   └── <a href="data/parkinsons.names">parkinsons.names</a>           UCI description file
├── <a href="scripts/">scripts/</a>                       R analysis scripts
│   ├── <a href="scripts/ethan_sandbox.R">ethan_sandbox.R</a>            Exploratory analysis (Aims 1 and 2)
│   ├── <a href="scripts/PD.PROJECT.Rmd">PD.PROJECT.Rmd</a>             Jason's data wrangling (creates the cleaned CSVs)
│   └── <a href="scripts/Aims_3_and_4.Rmd">Aims_3_and_4.Rmd</a>           Aims 3 and 4 (reads Jason's cleaned CSVs)
└── <a href="output/">output/</a>                        Generated results
    ├── <a href="output/eda/">eda/</a>                       Exploratory figures (PNG)
    └── <a href="output/aims_3_4/">aims_3_4/</a>                  Aims 3 and 4 tables and plots
</pre>

## Running the analysis

Open `Parkinson-s.Rproj` in RStudio (this sets the working directory to the project root), then run:

```r
source("scripts/ethan_sandbox.R")
```

Required packages: `dplyr`, `tidyr`, `ggplot2`, `lmerTest` (which installs `lme4`).

## Aims 3 and 4

The analysis is in [`scripts/Aims_3_and_4.Rmd`](scripts/Aims_3_and_4.Rmd). It starts from Jason's cleaned files, not the raw data, so **Jason's wrangling ([`scripts/PD.PROJECT.Rmd`](scripts/PD.PROJECT.Rmd)) must be run first**. His file explains every cleaning step in its "What we changed and why" section.

### Data used

Aims 3 and 4 use two separate UCI datasets. They have no shared subject IDs, so they are never joined.

| Dataset | Raw file | Cleaned file (from Jason) | Size | Used for |
|---|---|---|---|---|
| **PAD**: [Parkinson's Telemonitoring](https://archive.ics.uci.edu/dataset/189/parkinsons+telemonitoring) (Tsanas et al. 2010) | `data/telemonitoring/parkinsons_updrs.data` | `data/pad_clean.csv` | 5,875 home recordings from 42 people with PD, each with motor and total UPDRS | Aim 3 |
| **PUC**: [Parkinsons](https://archive.ics.uci.edu/dataset/174/parkinsons) (Little et al. 2009) | `data/parkinsons.data` | `data/puc_clean.csv` | 195 clinic recordings from 32 subject IDs: 24 with PD and 8 healthy. No UPDRS. | Aim 4 |

The [CODEBOOK](CODEBOOK.md) describes the raw PAD columns. The cleaned columns used here, created by Jason's file, are:

| Column | Dataset | Meaning |
|---|---|---|
| `subject` | both | Person ID. Each person has many recordings. |
| `motor_updrs`, `total_updrs` | PAD | UPDRS severity scores (the Aim 3 outcomes). Higher means more severe. |
| `jitter_pct`, `jitter_abs`, `jitter_rap`, `jitter_ppq5`, `shimmer`, `shimmer_db`, `shimmer_apq3`, `shimmer_apq5`, `shimmer_apq11`, `nhr`, `hnr` | both | The 11 voice measures both datasets share (the Aim 3 predictors). In PUC, `jitter_ppq5` and `shimmer_apq11` come from the columns `MDVP:PPQ` and `MDVP:APQ`. |
| `group` | PUC | `PD` or `healthy`, from the raw `status` column. |
| `jitter_score`, `shimmer_score`, `noise_score` | PUC | Jason's voice scores: each measure standardised, then averaged within its group. HNR is reversed so that **higher always means a worse voice**. Used in Aim 4. |

### How to run

Tested with R 4.6.1, tidyverse 2.0.0, ranger 0.18.0, rmarkdown 2.32 and knitr 1.52.

1. Install the packages once, in the R console:
   ```r
   install.packages(c("tidyverse", "ranger", "rmarkdown"))
   ```
2. Make sure Jason's cleaned files are in `data/`: `pad_clean.csv` and `puc_clean.csv`. Knitting `scripts/PD.PROJECT.Rmd` creates them.
3. Open `Parkinson-s.Rproj` in RStudio (**File → Open Project**), so R starts in the main repository folder.
4. Open `scripts/Aims_3_and_4.Rmd` and click **Knit**, or run it line by line. Knitting takes a few minutes, because the random forests are fitted many times.

All paths start from the main repository folder: the file reads `data/pad_clean.csv` and `data/puc_clean.csv`, and writes to `output/aims_3_4/`.

### What the file does, step by step

| Step | What happens | Why |
|---|---|---|
| 1. Wrangle (Jason) | [`PD.PROJECT.Rmd`](scripts/PD.PROJECT.Rmd) cleans the raw data and writes `data/pad_clean.csv` and `data/puc_clean.csv`. | Cleaning happens once, in the team's wrangling file. |
| 2. Read | `Aims_3_and_4.Rmd` reads the two cleaned CSVs: PAD (telemonitoring, 5,875 recordings, 42 people) and PUC (195 recordings, 32 IDs: 24 PD and 8 healthy). | PAD has UPDRS (Aim 3); PUC has healthy controls (Aim 4). They have no shared IDs, so they stay separate. |
| 3. Aim 3 models | Predicts motor and total UPDRS from the 11 voice measures with a mean baseline, linear regression and a random forest (`ranger`, 200 trees). The 10 measures other than HNR are logged first. | Jitter, shimmer and NHR are strongly right-skewed (see the [CODEBOOK](CODEBOOK.md)); logging reduces that skew. HNR is already in decibels, a log scale. The baseline shows whether voice adds anything. |
| 4. Aim 3 testing | Tests every model two ways: 5 random folds of recordings, and leave one person out. | Each person has about 140 recordings, so random folds let the model see the same person in training and testing. Leaving a person out matches predicting for a new patient. |
| 5. Aim 3 errors | Mean absolute error (MAE) in UPDRS points, per recording and per person. | MAE is in the same units as UPDRS, so it's easy to interpret. |
| 6. Aim 4 people | Averages each person's recordings into one row. | Recordings from one person are not independent; counting them separately would overstate the evidence. |
| 7. Aim 4 tests | Wilcoxon rank-sum test per score, Benjamini–Hochberg correction across the three, rank-biserial effect size. | Only 8 healthy people, so a rank test avoids assuming normal data. Three tests need a multiple-testing correction. |

### Outputs

Saved to `output/aims_3_4/`:

| File | Contents |
|---|---|
| `aim3_predictions.csv` | Every held-out prediction |
| `aim3_errors.csv` | MAE for each outcome, test design and model |
| `aim3_error.png` | Bar chart of the errors |
| `aim3_predicted_actual.png` | Predicted vs actual UPDRS, one dot per person |
| `aim4_people.csv` | One row of voice scores per person |
| `aim4_tests.csv` | Medians, test statistics, p-values and effect sizes |
| `aim4_boxplots.png` | PD vs healthy boxplots |

### Main results

- **Aim 3:** for a new person, neither voice model beat the mean baseline (motor UPDRS MAE: baseline 7.12, linear regression 7.27, random forest 7.31). With random folds the forest reached 5.90, close to the published result, because it had already seen each person.
- **Aim 4:** people with PD had worse scores on all three measures (adjusted p = 0.021 jitter, 0.020 shimmer, 0.043 noise), but the groups overlap.

### Notes for reproducing

- **Cleaned files.** `Aims_3_and_4.Rmd` only reads `data/pad_clean.csv` and `data/puc_clean.csv`. It never re-cleans the raw data or changes Jason's scores.
- **Fixed seeds.** The fold assignment and random forests use seed 2026, so a re-run gives the same numbers.
- **31 vs 32 people.** The PUC documentation says 31 people, but the file has 32 subject IDs. We use the IDs in the file.
- **Voice scores.** Aim 4 uses Jason's scores (standardised measures averaged within jitter, shimmer and noise, with HNR reversed), not the logged scores in `pd_figures.R`.

## References

1. GBD 2021 Nervous System Disorders Collaborators. Global burden of disorders affecting the nervous system, 1990–2021. *Lancet Neurol.* 2024.
2. Tsanas A, Little MA, McSharry PE, Ramig LO. Accurate telemonitoring of Parkinson's disease progression by noninvasive speech tests. *IEEE Trans Biomed Eng.* 2010;57(4):884–893.
3. Little MA, McSharry PE, Hunter EJ, Spielman J, Ramig LO. Suitability of dysphonia measurements for telemonitoring of Parkinson's disease. *IEEE Trans Biomed Eng.* 2009;56(4):1015–1022.
4. UCI Machine Learning Repository: [Parkinson's Telemonitoring](https://archive.ics.uci.edu/dataset/189/parkinsons+telemonitoring).
