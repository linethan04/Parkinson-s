# Can voice track Parkinson's disease?

Jason Spino, Ethan Lin and Kwaku Darkwah · QBS 181: Final Project · Dartmouth College

This is the text of the project website, [linethan04.github.io/Parkinson-s](https://linethan04.github.io/Parkinson-s/), as one document. The interactive charts and the R code drawers are only on the site; every number here comes from `docs/data/`, written by `scripts/export.R`.

## The story in a minute

**Could a few seconds of your voice track Parkinson’s disease?**
1. **Parkinson's disease is measured only a few times a year.** It's done with an exam called the UPDRS. It needs a clinic visit and trained staff, so months pass between one score and the next.
2. **A voice recording takes a few seconds.** A person holds an “ahhh”, and software measures how unsteady the sound is: **jitter** is wobble in pitch, **shimmer** is wobble in loudness, and **noise** is how breathy the voice is.
3. **Could voice recordings fill the gaps between clinic visits?** If voice follows the disease, a person could be checked frequently from home between exams. That is the idea we set out to test.
4. **Two public datasets had the recordings we needed.** One followed **42** people with PD at home for six months: **5,875** recordings, each paired with a UPDRS score. The other recorded **32** people in a speech lab: 24 with PD and 8 healthy.
5. **We boiled 11 voice measures down to three scores.** The two datasets used different participants, equipment and settings, so we kept them apart. We cleaned each one, dropped the columns we did not need, and combined the rest into jitter, shimmer and noise. Then we split each score in two: a person’s usual voice, and how far each recording strays from it.
6. **Then we asked two things of voice.** **Between people:** do people with worse voices have worse scores? **Within a person:** when one person’s voice gets worse, does their score rise? Four aims test this from four angles.
7. **So, can voice track Parkinson’s?**

## 1. The question
- More than **10 million** people worldwide live with Parkinson's disease (PD)
- About **89%** of people with PD have a speech or voice disorder

Parkinson's Disease (PD) severity is typically tracked with a clinical exam called the UPDRS. It requires a clinic visit and trained staff, so it only happens a few times a year. UPDRS is divided into two scores: the **motor** score and **non-motor** score. Motor score assesses neurological control of movement, while the non-motor score assesses mental symptoms. Together they make the **total** score; our data has the motor and total scores. Higher scores are worse.

A voice recording is far easier to get than UPDRS. A person holds an “ahhh” for a few seconds, and software measures how unsteady the sound is: **jitter** is wobble in pitch, **shimmer** is wobble in loudness, and **noise** is how breathy the voice is.

Our question considered both voice and severity measures: **Could a home “ahhh” recording replace the clinic exam?** We tested it four ways, using two public datasets.

Sources for the figures: American Parkinson Disease Association; a review in *NeuroRehabilitation* (IOS Press). UPDRS and voice measures: Tsanas et al., 2010.

## 2. The data

*Two datasets measured the same “ahhh”, but they cannot be joined.*

One study followed people with PD at home for six months. The other brought people with and without PD into a speech lab once.

**Why we kept them apart.** To join two datasets you need a column they share. These two studies used different participants, equipment and settings, so we treat each one on its own. Thus, we clean each dataset separately, give the voice measures the same names, and compare what each one finds.

**Why consider two studies, if they differ?** Only the home study has UPDRS, so it answers the questions about severity. Only the Oxford study has healthy people, so it answers whether PD voices differ from healthy ones.

#### For statisticians

In the home study, UPDRS was scored 3 times by a clinician (around 0, 3 and 6 months) and **linearly interpolated** for every recording in between – so recordings from one person are not independent. People made 101 to 168 recordings each, in 990 home sessions of about six recordings. Raw files: 5,875 × 22 and 195 × 24.

What the original authors reported: Tsanas et al. estimated UPDRS to within about 7.5 points of the clinicians' scores; Little et al. classified PD versus healthy correctly 91.4% of the time. Both figures are from the papers, not from our analysis.

### Road not taken: Why not stack the two datasets and fill in the gaps?

It is tempting to stack the two datasets and fill the gaps. The Oxford file has no UPDRS, age, sex or time, and methods we discussed in class such as **hot deck** (copy the value from a similar row) and **KNN** (average the nearest few rows) can invent them.

We tested the idea inside the home study. We hid each person's real UPDRS and tried to recover it from their voice.

**Filling in the missing columns would have been worse than guessing the average.**

Both methods missed motor UPDRS by more than simply guessing the average for everyone.

This is due to a few gaps between datasets: the Oxford study never collected UPDRS. So, imputing would hand healthy people UPDRS scores based on PD patients, then test voice against scores that were themselves predicted from voice. That is extremely circular.

#### For statisticians

The three error figures are mean absolute errors in motor UPDRS points, quoted from our project report. The script for this check is not in the repository, so unlike the rest of this page these numbers are not regenerated by `export.R`. The 7.1 is close to the leave-one-person-out mean baseline in Aim 3 (7.12).

## 3. Data wrangling

*The data arrived clean, so the work was deciding what to keep and what to build.*

#### Step 1: Check for problems

We looked for missing values and duplicate rows in both files and found **0** of each. Nothing needed fixing or removing.

*We found two oddities and kept them. **12** home recordings have a negative time: they are two early sessions (from people 34 and 42) made a few days before their official start date, and their UPDRS scores look normal. And the Oxford documentation says 31 people, but the file holds 32, so we use what the file contains.*

#### Step 2: Give both files the same names

The two files call the same measurement different things: `Jitter(%)` in one is `MDVP:Jitter(%)` in the other. We renamed both to one tidy set to a similar name (e.g., `jitter_pct`) so the same code works on either table.

#### Step 3: Drop columns that do not help

**Redundant.** `Jitter:DDP` is exactly 3 × `Jitter:RAP`, and `Shimmer:DDA` is 3 × `Shimmer:APQ3`. They carry no new information.

**Irrelevant.** RPDE, DFA and PPE were not in our proposal, and DFA looks different in the two studies. Additionally, `spread1`, `spread2`, and `D2` were in the Oxford study, but we had no use for them in our analysis plan.

#### Step 4: Keep 11 voice measures

Both tables now share the same 11 measures: **4 jitter**, **5 shimmer**, and two noise ratios (**NHR** and **HNR**). The home table also keeps who, when, age, sex and the two UPDRS scores. The Oxford table keeps who and whether they have PD.

#### Step 5: Turn 11 voice measures into 3 scores

The four jitter measures move together, and so do the five shimmer measures. We standardized each measure (a z-score), then averaged within each family to get `jitter_score`, `shimmer_score` and `noise_score`.

HNR was flipped because high HNR originally meant a *cleaner* voice. We did this to have the direction of our measures consistent – **a higher score always means a worse voice.**

#### Step 6: Split each score into “usual” and “today”

For the home study, each score becomes two columns. `_person` is that person's average, based on all their recordings: it represents their usual voice. `_diff` is one recording minus that participant's average: it represents the day-to-day fluctuations.

That is the most important data wrangling choice we made. The first column asks whether people with worse voices have worse symptoms (testing between people). The second asks whether a person's symptoms rise when their own voice gets worse (testing within a person).

#### Step 7: One row per person, with progression groups

Age and sex never change between recordings, so questions about them need one row per person. `pad_people` has each person's average UPDRS and how far their motor score moved from first to last recording.

A change of 2.5 points or more counts as non-stable (categorized by worsened or improved). That is the smallest change patients notice, from Shulman et al. (2010). By that rule **20** people worsened, **13** stayed stable and **9** improved.

#### For statisticians

Redundancy check: the largest gap between `Jitter:DDP` and 3 × `Jitter:RAP`, in either file, is 0.00001, which is rounding in the last printed digit. Median DFA among people with PD is 0.644 in the home study and 0.727 in the Oxford study.

Scores are standardised within each dataset, so 0 means “average for that dataset” and a home-study score cannot be compared directly with an Oxford score.

**Two versions of the scores exist in the repo.** The wrangling notebook averages z-scores of the raw measures; Aim 4 uses those. The Aim 1 and 2 script logs the skewed measures first and re-standardises the result so that one unit is one standard deviation; Aims 1 and 2 use those. The chapters below say which one they use.

Because UPDRS is interpolated, `_diff` and `motor_change` rest on only three real measurements per person.

Two matches are our best reading, not stated in the documentation: `MDVP:PPQ` as `jitter_ppq5` and `MDVP:APQ` as `shimmer_apq11`.

## 4. The four aims

*Four aims, one question: does voice follow a person, or only tell people apart?*

Our analysis is built around one main question: **can voice actually follow a person's Parkinson's over time, or does it only separate people from one another?** Each aim tackles a piece of that question, and each uses the method that fits how its data is structured.

Aims 1 to 3 use the home study dataset, and Aim 4 uses the Oxford study dataset.

**Home telemonitoring study (42 people with PD, 5,875 recordings)**

- **Aim 1: Which voice measures track UPDRS?** Every recording (5,875); Mixed-effects model. Splits each voice into a usual level (between people) and a day-to-day wobble (within a person).
- **Aim 2: How do age and sex relate to UPDRS?** One row per person (42); Linear regression. Checks whether age and sex explain the between-person signal from Aim 1.
- **Aim 3: Can voice predict UPDRS for a new patient?** Every recording, tested one whole person at a time; Leave-one-person-out testing. Tests whether voice can score a person the model has never heard.

**Oxford study (24 with PD, 8 healthy, 195 recordings)**

- **Aim 4: Do Parkinson's voices differ from healthy voices?** One row per person (32); Wilcoxon test. Asks whether the same measures separate PD from healthy.

### Aim 1: voice and UPDRS

**People with a worse usual voice tend to have higher UPDRS. A worse day does not come with a higher score.**

Using all 5,875 home recordings, we asked two questions.

**Between people:** does someone with a worse usual voice have a higher UPDRS?

**Within a person:** on days when their voice is worse than their own usual, is their UPDRS higher?

**Each blue dot** compares two people whose usual voices differ by one standard deviation. The person with the worse voice averages about 2.3 to 2.7 motor points higher.

The lines are wide because there are only 42 people. Since every line includes zero, a real link is possible but not proven.

**Each orange dot** asks what happens when one person's voice is worse than their own usual.

The answer sits near zero. A worse day indicated a UPDRS that is 0.06 to 0.11 points *lower*.

The within-person values were much smaller than the between-person ones.

The data shows voice telling people apart. It does not follow one person's ups and downs.

##### Why the within-person effect is near zero

Pick any person. Their voice scores jump around from week to week. Their UPDRS does not, because it was only scored at three clinic visits and filled in with straight lines.

##### For statisticians

One linear mixed model per outcome and voice score, fitted with `lmerTest::lmer`: `UPDRS ~ score_person + score_diff + months + (1 | subject)`. A random intercept per person and Benjamini–Hochberg correction across the 12 tests. **0** of the 12 effects have an adjusted p below 0.05.

Scores here are the logged versions from `aims_1_2_slides.R`, re-standardised so one unit is one SD across all recordings. About 92% of the variation in motor UPDRS is between people (intraclass correlation from an intercept-only model).

The within-person noise effect is small and negative with an unadjusted interval that excludes zero; after correction its adjusted p is 0.064. The per-person correlations on the site use session averages and motor UPDRS (Spearman).

### Aim 2: age and sex

**Older people tended to have higher UPDRS. Men and women looked alike.**

Age and sex do not change between recordings, so here each of the 42 people counts once, using their average UPDRS.

**Age.** Each extra decade went with **+2.5** motor points (p = 0.06) and **+3.7** total points (p = 0.035). Older age is significantly linked to a higher total UPDRS; for motor UPDRS, the link falls just short of significance.

**Sex.** At the same age, men scored +0.6 motor points (p = 0.81) and +2.2 total points (p = 0.50) higher than women. Sex was not significantly associated with either score, though with only 14 women the study had little power to detect a difference.

##### Who got worse over six months?

We compared each person's last motor score with their first. A change of at least 2.5 points is the smallest that patients notice, so that is our cut-off: **20** worsened, **13** stayed stable and **9** improved. The improved group was younger, with a median age of 59 against 65 and 66, though with groups this small that gap could be chance.

##### A bridge back to Aim 1

If older people have higher UPDRS, and older voices are also less steady, then some of the voice signal in Aim 1 may really be age. Shimmer is the score most tied to age (r = 0.31). Once age and sex are in the model, every between-person voice effect shrinks.

##### For statisticians

Ordinary least squares on one row per person (n = 42): `mean UPDRS ~ age + sex`. The lines in the scatter are that model's fitted values for men and women. R² is 0.09 for motor and 0.12 for total.

Unadjusted, men averaged 21.3 motor points and women 20.3 (Welch t-test p = 0.73). Age across the three progression groups: Kruskal–Wallis p = 0.52.

The site's cut-off slider recomputes the groups with the same rule as the wrangling notebook for cut-offs from 0.5 to 6.0; counts, medians and the Kruskal–Wallis p-value at each cut-off come from `export.R`. Correlations of usual voice with age: jitter 0.18, shimmer 0.31, noise 0.18 (Pearson, logged scores).

### Aim 3: prediction

**For a person the model has never heard, voice predicted UPDRS no better than guessing the average.**

We trained three models to predict UPDRS from the 11 voice measures: a **mean baseline** (that ignores voice and always guesses the average), a **linear regression** and a **random forest**.

**Random rows** shuffles all the recordings and picks them at random, so the same people show up in both training and testing. The model can recognize each person’s voice and recall their score, which makes it look more accurate than it really is.

**New person** holds out everyone's recordings in turn: train on 41 people, test on the 42nd, repeat 42 times.

**With random rows, voice looks useful.** On average, the random forest's predictions are off by 5.90 motor UPDRS points, which is better than just guessing the average (6.96).

**Tested on new people, the advantage is gone.** The same random forest now misses by 7.31 points.

**Guessing the average does better.** The no-voice baseline misses by 7.12. Linear regression (7.27) and the random forest (7.31) are both worse, and the same holds for total UPDRS.
- **5.90** Random forest, tested on random rows
- **7.31** The same forest, tested on new people
- **7.12** Guessing the average, for new people

Average miss in motor UPDRS points. Lower is better.

##### What the random forest actually learned

If the model were perfect, every dot would sit on the diagonal. With random rows, the dots come close, but only because the model recognizes familiar voices. With new people, the dots flatten into a line: everyone gets roughly the same guess.

**How this compares to the original study.** Using the original study’s test, our model matches their accuracy (7.47 vs. about 7.5). But that test reused people the model had already heard. For a new person, the model does worse than guessing the average (9.29 vs. 8.86).

##### For statisticians

Predictors: the 11 voice measures, with the ten other than HNR logged. Random rows: 5 shuffled folds of recordings. New person: leave-one-subject-out, 42 folds. Random forest: `ranger`, 200 trees, `mtry = 3`, minimum node size 5, seed 2026. In the random split every person has at least 71% of their recordings in the training folds.

MAE weights recordings equally. The equal-person MAE (average within person first) gives the same ordering. These are point estimates with no test of the difference between models, and the result describes these models, not every possible voice model.

### Aim 4: PD vs healthy

**Voices of people with Parkinson's score worse on average, but a group difference is not an individual diagnosis.**

The Oxford study lets us compare 24 people with PD against 8 healthy people. Each person's recordings are averaged first, so everyone counts once.

On all three scores the PD group sits higher, and the differences hold up after correcting for running three tests: adjusted p = **0.021** for jitter, **0.020** for shimmer and **0.043** for noise.

The shaded bands signal something interesting. **15** of the 24 people with PD have a jitter score inside the healthy group's range, 10 for shimmer and 21 for noise. Knowing someone’s score would not reliably tell you whether they’re healthy or have PD. The groups differ; the individuals overlap.

##### For statisticians

Two-sided Wilcoxon rank-sum tests with continuity correction, on one mean score per person (n = 32), Benjamini–Hochberg corrected across the three scores. The rank-biserial effect size runs from −1 to 1; positive means the PD group ranks higher. Scores are the wrangling notebook's averages of z-scored raw measures.

These are unadjusted comparisons. The Oxford file has no age or sex, so we cannot check whether those explain part of the gap, and 8 healthy people is a small group.

## 5. Conclusion

*Voice separates people better than it tracks one person over time.*

Here's what we found.
- **Between people, there is a signal.** People with PD have less steady voices than healthy people (Aim 4), and among people with PD a worse usual voice leans towards a higher UPDRS (Aim 1).
- **Within a person, there is no signal.** A worse voice day did not come with a higher UPDRS (Aim 1), and voice could not predict the score of someone the model had never heard (Aim 3).
- **Age is influential.** Older people had higher UPDRS, and the voice effect shrank once age was accounted for (Aim 2).

#### Limits to keep in mind
- **UPDRS was scored at only 3 visits** and filled in between with straight lines, so the within-person result may understate what voice can do.
- **The samples are small:** 42 people with PD in one study, and only 8 healthy people in the other.
- **These are associations, not causes.** Things we could not measure, such as fatigue or the recording setting, may play a part.

We hope this gives an honest picture of what voice can and can't do before anyone relies on it for patient care.

## Reproduce it and credits

**Three scripts and one seed rebuild every result on this page.**

Everything is in the [GitHub repository](https://github.com/linethan04/Parkinson-s), including both raw data files. Install the R packages once, then open `Parkinson-s.Rproj` in RStudio. All paths start from that folder.

```r
install.packages(c("tidyverse", "lmerTest", "patchwork", "ggrepel",
                   "ranger", "ragg", "rmarkdown"))
```
1. [`scripts/aims_1_2_slides.R`](https://github.com/linethan04/Parkinson-s/blob/main/scripts/aims_1_2_slides.R) – Aim 1 mixed models and Aim 2 regression, t-test and Kruskal–Wallis. Run it with `source()`; it takes about 20 seconds.
2. [`scripts/PD.PROJECT.Rmd`](https://github.com/linethan04/Parkinson-s/blob/main/scripts/PD.PROJECT.Rmd) – Knit it. Cleans both datasets, builds the scores, the usual-versus-today split and the progression groups, and saves the cleaned files to `data/`.
3. [`scripts/Aims_3_and_4.Rmd`](https://github.com/linethan04/Parkinson-s/blob/main/scripts/Aims_3_and_4.Rmd) – Knit it after `PD.PROJECT.Rmd`. Aim 3 prediction and Aim 4 group comparison. Takes a few minutes.

*The repository also has [`scripts/pd_figures.R`](https://github.com/linethan04/Parkinson-s/blob/main/scripts/pd_figures.R), which makes the 13 final figures for our report in about 90 seconds. The numbers on this page do not depend on it.*

Random steps use **seed 2026**, so a re-run gives the same numbers.

To rebuild the data behind this page in one go, run `Rscript scripts/export.R` from the project root. It repeats the same analysis code from the raw files and writes the JSON in `docs/data/` that every chart here is drawn from. It needs one more package, `jsonlite`.

**Made by Jason Spino, Ethan Lin and Kwaku Darkwah.**

Final project for Data Wrangling, MS in Health Data Science, Dartmouth.

#### References
1. Tsanas A, Little MA, McSharry PE, Ramig LO. Accurate telemonitoring of Parkinson's disease progression by noninvasive speech tests. *IEEE Trans Biomed Eng.* 2010;57(4):884–893. [doi:10.1109/TBME.2009.2036000](https://doi.org/10.1109/TBME.2009.2036000)
2. Tsanas A, Little MA, McSharry PE, Ramig LO. Nonlinear speech analysis algorithms mapped to a standard metric achieve clinically useful quantification of average Parkinson's disease symptom severity. *J R Soc Interface.* 2011;8(59):842–855. [doi:10.1098/rsif.2010.0456](https://doi.org/10.1098/rsif.2010.0456)
3. Little MA, McSharry PE, Hunter EJ, Spielman J, Ramig LO. Suitability of dysphonia measurements for telemonitoring of Parkinson's disease. *IEEE Trans Biomed Eng.* 2009;56(4):1015–1022. [doi:10.1109/TBME.2008.2005954](https://doi.org/10.1109/TBME.2008.2005954)
4. Shulman LM, Gruber-Baldini AL, Anderson KE, et al. The clinically important difference on the Unified Parkinson's Disease Rating Scale. *Arch Neurol.* 2010;67(1):64–70. [doi:10.1001/archneurol.2009.295](https://doi.org/10.1001/archneurol.2009.295)

#### Data
- Tsanas A, Little MA. Parkinsons Telemonitoring [Dataset]. UCI Machine Learning Repository; 2009. [doi:10.24432/C5ZS3N](https://doi.org/10.24432/C5ZS3N)
- Little MA. Parkinsons [Dataset]. UCI Machine Learning Repository; 2007. [doi:10.24432/C59C74](https://doi.org/10.24432/C59C74)

#### AI use

Claude (Anthropic) helped write and debug the R code and outline the slides; we reviewed and verified all analyses and conclusions. This website was built with Claude Fable 5.2 and Claude Opus 5.5, which turned our analysis and ideas into the site; we wrote, reviewed and edited all of its text and statistics.

*Charts drawn with [D3](https://d3js.org).*
