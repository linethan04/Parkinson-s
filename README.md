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

**Overall goal:** show how voice changes track PD severity, and test whether voice alone predicts UPDRS with clinically useful accuracy. The results could be evidence for or against low-cost remote symptom monitoring.

**Limitations:** there are only 42 patients, and UPDRS is linearly interpolated between clinic visits rather than measured at each recording, so recordings from the same patient are not independent.

## Repository structure

<pre>
<a href="./">Parkinson-s/</a>
├── <a href="README.md">README.md</a>                      Project overview (this file)
├── <a href="CODEBOOK.md">CODEBOOK.md</a>                    Variable definitions
├── <a href="Parkinson-s.Rproj">Parkinson-s.Rproj</a>              RStudio project file
├── <a href="data/">data/</a>                          Raw data (read-only)
│   └── <a href="data/parkinsons+telemonitoring/">parkinsons+telemonitoring/</a>
│       ├── <a href="data/parkinsons+telemonitoring/parkinsons_updrs.data">parkinsons_updrs.data</a>      Dataset (CSV)
│       └── <a href="data/parkinsons+telemonitoring/parkinsons_updrs.names">parkinsons_updrs.names</a>     UCI description file
├── <a href="scripts/">scripts/</a>                       R analysis scripts
│   └── <a href="scripts/ethan_sandbox.R">ethan_sandbox.R</a>            Exploratory analysis (Aims 1 and 2)
└── <a href="output/">output/</a>                        Generated results
    └── <a href="output/eda/">eda/</a>                       Exploratory figures (PNG)
</pre>

## Running the analysis

Open `Parkinson-s.Rproj` in RStudio (this sets the working directory to the project root), then run:

```r
source("scripts/ethan_sandbox.R")
```

Required packages: `dplyr`, `tidyr`, `ggplot2`, `lmerTest` (which installs `lme4`).

## References

1. GBD 2021 Nervous System Disorders Collaborators. Global burden of disorders affecting the nervous system, 1990–2021. *Lancet Neurol.* 2024.
2. Tsanas A, Little MA, McSharry PE, Ramig LO. Accurate telemonitoring of Parkinson's disease progression by noninvasive speech tests. *IEEE Trans Biomed Eng.* 2010;57(4):884–893.
3. Little MA, McSharry PE, Hunter EJ, Spielman J, Ramig LO. Suitability of dysphonia measurements for telemonitoring of Parkinson's disease. *IEEE Trans Biomed Eng.* 2009;56(4):1015–1022.
4. UCI Machine Learning Repository: [Parkinson's Telemonitoring](https://archive.ics.uci.edu/dataset/189/parkinsons+telemonitoring).
