---
title: 'Parkinson’s disease in the spinal cord: an exploratory study to establish T2*w, MTR and diffusion-weighted imaging metric values'
tags:
  - Preprint
  - Spinal Cord
  - Parkinson's disease
  - MRI
authors:
  - name: Samuelle St-Onge
    orcid: 0000-0001-7572-8504
    affiliation: "1,2"
  - name: Camille Coustaury
    orcid: null
    affiliation: "1"
  - name: Caroline Landelle 
    orcid:  
    affiliation: "3"
  - name: Linda Solstrand Dahlberg
    orcid: 0000-0002-1090-7138
    affiliation: "3"
  - name: Ovidiu Lungu
    orcid: 0000-0001-6608-5818
    affiliation: "3,4"
  - name: Julien Doyon
    orcid: null
    affiliation: "3"
  - name: Benjamin De Leener
    orcid: 0000-0002-1378-2756
    affiliation: "1,2,5"

affiliations:
- name: NeuroPoly Lab, Institute of Biomedical Engineering, Polytechnique Montréal, Montreal, QC, Canada.
  index: 1
- name: CHU Sainte-Justine Research Centre, Montreal, QC, Canada.
  index: 2
- name: McConnell Brain Imaging Centre, Department of Neurology and Neurosurgery, Montreal Neurological Institute, McGill University, Montreal, QC, Canada.
  index: 3
- name: Département de psychiatrie et addictologie, Université de Montréal, Montreal, QC, Canada.
  index: 4
- name: Computer Engineering and Software Engineering, Polytechnique Montréal, Montreal, QC, Canada.
  index: 5

bibliography: paper.bib
date: "21 May 2025"
---

# Abstract

Parkinson's disease (PD) is primarily defined by brain pathology, including dopamine neuron degeneration and α-synuclein aggregation. Emerging evidence suggests that the spinal cord is also affected, with ex-vivo studies reporting abnormal α-synuclein protein aggregation within the spinal cord of PD patients. While advanced imaging techniques, such as diffusion tensor imaging (DTI), neurite orientation dispersion and density imaging (NODDI), T2*-weighted (T2*w) imaging, and the magnetization transfer ratio (MTR) have demonstrated potential for detecting PD-related changes in the brain, their application to uncover spinal cord alterations remains unexplored. This study is the first to investigate MRI-derived microstructural metrics in the spinal cord of PD patients, comparing them to healthy controls. Although this study found limited microstructural or structural differences in the spinal cord between PD patients and healthy controls, these findings are consistent with recent results from PD mouse models and complement an earlier functional MRI study using the same cohort, where significant findings were observed. Our lack of significant structural findings may suggest that functional spinal cord changes are more sensitive markers of Parkinson’s disease progression — particularly in relation to clinical measures such as the Unified Parkinson’s Disease Rating Scale (UPDRS). These results highlight the need for further research to better understand how PD-related alterations in the spinal cord compare to normal aging processes and relate to functional changes.

# Introduction

Parkinson's disease (PD) is a neurodegenerative disease that is defined by both the degeneration of dopamine-producing neurons inside the substantia nigra [@nyatega_gray_2022] and the abnormal accumulation of α-synuclein inside neurons, forming abnormal protein aggregates commonly referred to as Lewy bodies [@bianco_-synucleinopathy_2002; @muller_staging_2005]. While PD has traditionally been linked to brain pathology, markers of the disease have been identified in the spinal cord, notably the presence of abnormal aggregation of α-synuclein proteins inside spinal cord axons [@nardone_spinal_2020]. 

Indeed, post-mortem studies have reported a higher number of α-synuclein aggregates in the spinal cord of PD patients compared to their healthy counterparts [@braak_parkinsons_2007; @del_tredici_spinal_2012]. While cases of α-synuclein aggregates found exclusively in the spinal cord are rare, α-synucleinopathy is commonly observed in the spinal cord when it is also present in the brain. This pattern suggests that, in such cases, PD may affect the midbrain before the spinal cord [@del_tredici_spinal_2012]. There is also extensive evidence indicating that PD may originate in the enteric nervous system (ENS) before progressing to the midbrain [@del_tredici_spinal_2012; @del_tredici_review_2016], supporting the distinction between body-first and brain-first subtypes of PD [@horsager_brain-first_2020; @leclair-visonneau_gut_2020]. Post-mortem studies further suggest that brain-first PD may begin in the olfactory system or the amygdala [@horsager_brain-first_2020]. Nonetheless, the origin of PD within the body remains under debate, along with the mechanisms through which the disease spreads to the spinal cord.

The work of [@bloch_-synuclein_2006] has shown a higher concentration of α-synuclein in the lower brainstem than in the spinal cord, which is consistent with the findings of [@del_tredici_spinal_2012]. Furthermore, [@del_tredici_spinal_2012] identified globules filled with α-synuclein in individuals with advanced PD, as opposed to small varicosities in earlier stages, consistent with findings from [@sekigawa_role_2015], who observed axonal swelling associated to α-synuclein in the spinal cord of transgenic mice. Recently, [@combes_spiral_2024] have studied structural MRI in the spinal cord of transgenic PD mice. Their results revealed no structural changes in the spinal cord of the PD mouse compared with their non-transgenic counterparts. Functional aspects of PD in the human spinal cord have been explored in-vivo by [@landelle_altered_2023], using functional magnetic resonance imaging (fMRI), where a decrease of functional connectivity in conjunction with disease progression has been observed in the cervical spinal cord. Nevertheless, *in-vivo* spinal cord studies for PD remain limited, and the structural aspects of PD on the human spinal cord remain unexplored, hence the relevance of investigating MRI-derived metrics on the human spinal cord, *in-vivo*. 

Diffusion-weighted imaging (DWI) is a promising modality to quantify spinal cord microstructure, as it provides information regarding the diffusion of water molecules that can indicate tissue abnormalities and damage. The diffusion tensor imaging (DTI) model is amongst the most widely used diffusion MRI models, allowing to measure fractional anisotropy (FA), mean diffusivity (MD), radial diffusivity (RD) and axial diffusivity (AD) [@odonnell_introduction_2011]. Although a few studies have investigated DTI to quantify gray matter integrity such as in healthy aging [@pfefferbaum_diffusion_2010], DTI is predominantly used to study the white matter, given its strong anisotropy [@assaf_diffusion_2008]. Recent work has demonstrated the usefulness of DTI to unveil microstructural tissue damage in PD patients for several regions of the brain, such as the substantia nigra and corpus callosum [@atkinson-clement_diffusion_2017; @kotian_diffusion_2020]. Notably, a decrease in FA has been reported with PD progression in the brain [@kotian_diffusion_2020]. Yet, although DTI metrics have demonstrated potential for identifying PD-related microstructural changes at the brain level, to our knowledge, these metrics have not been studied in the spinal cord of PD patients. 

Another DWI model that shows promise is the Neurite Orientation Dispersion and Density Index (NODDI) [@zhang_noddi_2012], which allows tissue voxels to be compartmentalized into intracellular, extracellular and cerebrospinal fluid compartments. NODDI metrics include the orientation dispersion index (ODI), the isotropic volume fraction (FISO) and neurite density (FICVF). Previous brain-focused studies have reported reduced values for FICVF and ODI in the substantia nigra pars compacta among individuals with PD [@kamagata_what_2016; @kamagata_neurite_2016]; a phenomenon suspected to be linked to the loss of dopaminergic neurons associated with PD in the brain [@kamagata_what_2016]. Also in the brain, [@mitchell_neurite_2019] found that ODI increased in white matter while decreasing in gray matter, suggesting possible axonal degeneration or disorganization in white matter, and dendritic thinning in gray matter. However, to our knowledge, no *in vivo* studies have demonstrated neuronal loss related to PD in the spinal cord. 

Others have explored T2\*-weighted (T2\*w), or its reciprocal R2* (1/T2\*), as a promising method for identifying PD-related changes in the brain. In their study, [@schwarz_parkinsons_2018] noticed a decrease in T2\*w signal inside the substantia nigra and nigrosomes in subjects with PD compared to healthy individuals. Since T2\*w is sensitive to changes in susceptibility, this decrease has been attributed to iron accumulation, which is well documented in the brain of PD patients [@schwarz_parkinsons_2018; @tambasco_t2-weighted_2019; @zeng_iron_2024]. Studies suggest that iron deposition is responsible for triggering the activation of immune cells in the brain, which in turn release substances that cause inflammation and cause oxidative stress. This process may aggravate the loss of dopaminergic neurons and contribute to disease progression in PD patients [@zeng_iron_2024]. Iron accumulation related to PD in the spinal cord has not been reported to date. However, given that the involvement of the spinal cord in PD is still not fully understood, exploring T2\*w in the spinal cord of PD patients may reveal subtle changes in tissue susceptibility that were not identified in previous post-mortem studies.  Similarly, the magnetization transfer ratio (MTR) has demonstrated relevance in the context of PD in the brain, where studies have noted a decrease in MTR in several brain regions such as the substantia nigra in early PD stages, which is thought to also be linked to iron deposition in the brain [@anik_magnetization_2007; @tambasco_t2-weighted_2019; @tambasco_magnetization_2011]. However, despite the interest in studying T2\*w and MTR metrics in the PD brain, their investigation for PD in the spinal cord remains unexplored.

The present study thus seeks to address all the above-mentioned knowledge gaps by assessing  the potential of quantitative MRI to detect microstructural changes in the spinal cord related to Parkinson’s disease. We aim to establish relationships between PD progression and T2\*w, MTR, DTI and NODDI values in the cervical spinal cord. Disease progression was assessed using the motor component of the Unified Parkinson’s Disease Rating Scale (UPDRS) [@movement_disorder_society_task_force_on_rating_scales_for_parkinsons_disease_unified_2003] to correlate these metrics with motor symptom severity. Additionally, PD stage was explored by categorizing participants into early, mid and advanced groups based on their UPDRSIII motor scores. The study also seeks to evaluate whether DTI, NODDI, T2\*w and MTR metrics can be used to differentiate PD patients from their healthy counterparts, which could lead to identifying potential biomarkers for PD in the spinal cord. 

# Methods

## Data acquisition

The study involved the same participants as in [@landelle_altered_2023], who have been scanned at the Montreal Neurological Institute-Hospital using a 3 Tesla MRI scanner (Magnetom Prisma, Siemens, Erlangen, Germany). All participants gave their written consent in accordance with the Helsinki Declaration, and the experiment was approved by the local ethics committee (MUCH REB 2019-4626). The acquisition protocol included a T1w, T2\*w, magnetization transfer (MT) and a multi-shell diffusion MRI sequence. The detailed acquisition parameters for T2\*w, MTR and DWI are presented in [Figure 1](#fig1). [Figure 2](#fig2) shows examples of raw data acquisitions for a single subject. Because of the limited field-of-view of the acquisitions, only the cervical spinal cord from spinal levels C2 to C5 was considered for this study. 

Participants (N=106; 65 M, 41 F) included both patients with PD (N=68; 47 M, 21 F) and matched healthy control subjects (HC) (N=38; 20 F, 18 M). Individuals with PD underwent clinical interviews and neurological examinations, including an assessment of disease severity with the UPDRS. Using Part III of the UPDRS, which corresponds to the assessment of motor symptoms, participants with PD were further categorized into three group stages: early PD (UPDRSIII 0-20), mid PD (UPDRSIII 20-30), advanced PD (UPDRSIII 30-60). The participants' ages ranged from 38 to 83 years old. The mean ages and standard deviations for each group were as follows: overall (N = 106): mean = 64, SD = 10; healthy controls (N=38) : mean= 62, SD = 11; early PD (N=23) : mean = 61, SD = 10; mid PD (N=22): mean = 64, SD = 7; advanced PD (N=23): mean = 68, SD = 10. [Figure 1](#fig1) shows the number of participants per category, for each sequence. The age, sex and UPDRSIII score distribution of the subjects are also presented in [Figure 1](#fig1).   

:::{figure} #fig1cell
:label: fig1

(A) Acquisition parameters for T2*w, MTR and DWI; (B) Number of participants per category (controls, early PD,  mid PD and advanced PD) for each sequence according to their UPDRSIII score (C) Age and UPDRSIII distributions.
:::

:::{figure} #fig2cell
:label: fig2

Representative raw data of T2\*w, MT0/MT1, and DWI from a single subject.
:::

## Data pre-processing and metric extraction

FA, MD, RD and AD metrics were computed from the DWI images using DTI from DIPY via the [Spinal Cord Toolbox (SCT)](https://spinalcordtoolbox.com/stable/index.html) [@de_leener_sct_2017]. ODI, FISO and FICVF metrics were computed using the [NODDI Matlab Toolbox](http://mig.cs.ucl.ac.uk/index.php?n=Tutorial.NODDImatlab) [@ucl_microstructure_imaging_group_noddi_2021]. The motion correction algorithm from SCT was attempted on the DWI images but did not improve image quality and occasionally introduced noise; therefore, uncorrected data were used in subsequent analyses. Using SCT, magnetization transfer (MT) images with and without the MT pulse were co-registered, and magnetization transfer ratio (MTR) maps were computed from the co-registered data. The individual MTR, T2\*w and DWI images underwent initial preprocessing with SCT, which first included spinal cord segmentation using the sct_propseg algorithm and manual corrections when necessary. Because of the thick slices of T2\*w (2 mm), MTR and DWI (5 mm) acquisitions, it was difficult to label the vertebrae on these images directly. For this reason, vertebral labeling was performed on T1w acquisitions (slice thickness = 1.3 mm) and were coregistered to the [PAM50 template](https://spinalcordtoolbox.com/stable/overview/concepts/pam50.html) [@de_leener_pam50_2018]. Then, the generated warping fields were used to initialize the coregistration of T2\*w, MTR, DTI and NODDI images to the PAM50 template. Thus we generated average group-level metric maps (i.e., average pixel wise intensity) for both HC and PD subjects, at spinal levels C2 to C5 in the PAM50 space. 

Using the atlas from the co-registered PAM50 template, we extracted DTI metrics from the white matter and its subregions (dorsal columns, ventral funiculi, and lateral funiculi) to quantify axonal damage, which may be linked to the presence of α-synuclein aggregates in white matter axons, leading to reduced diffusion anisotropy. Similarly, NODDI metrics were extracted from the white matter and its subregions for their sensitivity to axonal integrity and changes in diffusion orientation. Additionally, NODDI metrics were analyzed in the gray matter to detect potential alterations in dendrite orientation and integrity. MTR values were extracted from the white matter and its subregions due to their sensitivity to demyelination, often linked to axonal loss. Finally, the white matter to gray matter ratio (WM/GM) ratio was calculated from T2\*w images using white and gray matter values extracted using the PAM50 atlas. The ratio was chosen because gray matter naturally contains higher iron levels than white matter, and T2\*w is particularly sensitive to iron content. 

Importantly, all metrics were extracted using the spinal levels [@frostell_review_2016] instead of the vertebral levels, to offer a representation that reflects more accurately the functional organization of the spinal cord into different rootlets, thereby enabling more robust comparisons with the findings of [@landelle_altered_2023] in functional MRI. The cross-sectional area of the spinal cord was also computed on all individual T2\*w images via *sct_process_segmentation* from SCT. 

## Effect of groups and UPDRSIII score on MRI metrics

We investigated the relationships between PD and MRI-derived metrics (DTI, NODDI, T2\*w ratio, and MTR) in the cervical spinal cord by examining how the metrics varied across different groups (controls, early PD, mid PD, and advanced PD). To this end, we performed an analysis of variance (ANOVA) on the mean metric value extracted across spinal levels C2–C5. Age was included as a covariate to control for its potential confounding effects. Post-hoc t-tests were performed on metrics that showed significant results (p < 0.05) to further explore group differences. 

To explore the relationship between disease progression and microstructural changes detectable through our metrics, we employed an ordinary least-squares (OLS) regression model to assess the correlations between DTI, NODDI, T2\*w, and MTR metrics with UPDRSIII scores, while controlling for age as a potential confounder. For each metric, the OLS analysis was performed for spinal levels C2 to C5 separately. DTI, NODDI and MTR metrics were studied in the white matter and its subregions (dorsal columns, ventral funiculi, lateral funiculi) to identify potential changes which may be attributed to the accumulation of α-synuclein inside white matter axons. Due to its ability to identify changes in gray matter dendrites, NODDI was also calculated in the gray matter, to investigate whether differences in these metrics could be identified with an increasing UPDRSIII score. Finally, the WM/GM was studied using T2\*w images. To control for the risk of type I errors due to multiple comparisons, the p-values were adjusted using the Benjamini-Hochberg method, also known as the false-discovery rate (FDR) correction. Cross-sectional area (CSA) was also examined using the above-mentioned ANOVA and OLS models to detect potential structural changes in the cervical spinal cord associated with PD. 

# Results

## Average metric maps

[Fig. %sf](#fig3) shows the average metric maps for DTI, NODDI and MTR, obtained by registering the metrics to the PAM50 template and computing the pixel-by-pixel average intensity for each subject category (HC, early PD, mid PD and advanced PD).  

:::{figure} #fig3cell
:label: fig3

Average spinal cord maps of DTI, NODDI and MTR metrics for C2, C3, C4, and C5 spinal levels in  healthy control participants (HC), early PD, mid PD, advanced PD and all PD participants combined. 
:::

The average metric maps in [Figure 3](#fig3) revealed an increase in ODI and a decrease in FA within the white matter among PD participants compared to their healthy counterparts. Additionally, a decrease in global intensity is observed as we progress through the more caudal spinal levels, which is particularly apparent in MTR and FA maps. 

## Cross-sectional area (CSA) of PD subjects versus healthy controls 

[Fig. %sf](#fig4) presents the results of ANOVA comparing spinal cord cross-sectional area (CSA) across HC, early PD, mid PD, and advanced PD groups. The results revealed no significant differences in spinal cord cross-sectional area (CSA) between groups. Additionally, an OLS analysis revealed no significant correlation between the UPDRSIII score and the CSA (Table 1), but rather a significant correlation of age and CSA at C3 and C4 spinal levels (p-Age = 0.002). These results suggest that the cervical spinal cord CSA is not affected by PD. 

:::{figure} #fig4cell
:label: fig4

Fig 4.  ANOVA for the spinal cord cross-sectional area (CSA) for HC in comparison with PD subjects categorized by their UPDRSIII score (early PD, mid PD and advanced PD), for spinal levels C2 to C5 combined.
:::

:::{figure} content/tables/table1.png

Table 1. P-values for UPDRSIII and Age variables for the cross-sectional area (CSA) following ordinary least squares (OLS) analysis. The significance level was corrected for each metric, by dividing α=0.05 by the number of spinal levels studied. 
:::

## Comparisons across groups (healthy controls, early PD, mid PD and advanced PD)

[Figure 5](#fig5) presents the results of an ANOVA comparing DTI, NODDI, MTR, and T2\*w metrics across the different groups (HC, early PD, mid PD, and advanced PD). In the white matter, our results showed a significant effect of group on FA and RD metrics, for the combined spinal levels C2 to C5 (FA : p-Group = 0.0180; RD : p-Group = 0.0179). Post-hoc pairwise t-tests with false discovery rate (FDR) correction were then applied to FA and RD in WM to compare early PD, mid PD and advanced PD subjects with the HC group (Table 2), where results showed a significant difference between HC and the advanced PD group for FA in the WM (p=0.0402), and between HC and mid PD for RD in the WM (p=0.0281). 

:::{figure} #fig5cell
:label: fig4

Fig 5. ANOVA for NODDI, DTI, T2\*w and MTR across groups (HC, early PD, mid PD, adv PD)  in (A) the white matter, (B) the gray matter and (C) the white matter to gray matter ratio, for spinal levels C2 to C5 combined. Significant group differences are indicated with a red asterisk (\*). 
:::

:::{figure} content/tables/table2.png

Table 2. FDR-corrected p-values following post-hoc pairwise t-tests between HC – early PD, HC – mid PD and HC – advanced PD. The significant p-values (<0.05) are shown in red with an asterisk (\*). 
:::

## Correlation analyses with UPDRSIII scores

We employed an ordinary least-squares (OLS) regression model to explore the associations between DTI, NODDI, T2\*w, and MTR metrics and UPDRSIII scores, with age included as a covariate to account for its potential confounding effects. Prior to conducting the OLS regression analysis, we assessed the potential collinearity between age and UPDRSIII scores. The Variance Inflation Factor (VIF) found was 1.1, which is well below the commonly-used threshold of 10, hence indicating minimal multicollinearity between age and UPDRSIII in our data. This suggests that age and UPDRSIII provide largely independent information, and including both in our model is unlikely to compromise its integrity. Furthermore, with a low Pearson coefficient of r=0.31, the relationship between UPDRSIII and age appears weak, suggesting that age alone is not a strong predictor of UPDRSIII in this cohort. 

Table 3 presents the p-values from the OLS model for the UPDRS-III and age variables, examining DTI, NODDI, and MTR metrics in relation to UPDRS-III score progression across each studied region. FDR correction was applied for each metric, taking into account all regions and vertebral levels shown in Table 3 (i.e., 16 p-values for MTR and DTI metrics, 20 for NODDI, and 4 for T2\*w). P-values in bold text marked with an asterisk (\*) indicate statistical significance after applying FDR correction for multiple comparisons. Figures illustrating the regression plots for all metrics with respect to the UPDRSIII score, across each metric and spinal cord subregion, can be found in the supplementary material. 

As reported in Table 3, some trends were observed in specific regions, for individual spinal levels and for some of our metrics. Some p-values for the UPDRSIII score were below α = 0.05, but none remained significant after FDR correction. For instance, an increase in ODI, FICVF, and FISO was observed in relation to UPDRSIII across all spinal cord subregions, along with a decrease in FA, which was prominent at the C4 and C5 levels. The OLS regression model revealed an effect of the UPDRSIII on FA for the entire white matter at spinal levels C3 (p-UPDRSIII = 0.021) and C5 (p-UPDRSIII = 0.029), as well as in some sub-regions of the white matter. Effects of the UPDRSIII score were also observed on other metrics and regions such as RD at spinal level C2 (p-UPDRSIII = 0.043), FISO in the ventral funiculi at spinal level C2 (p-UPDRSIII = 0.013) and FICVF in the dorsal columns at spinal level C5 (p-UPDRSIII = 0.027). In the gray matter, the UPDRSIII revealed an effect on the FICVF at C5. Our findings also suggest an increase in the WM/GM ratio in T2\*, particularly at the C4 spinal level. However, when correcting for multiple comparisons, no results were found significant for the UPDRSIII on any of the studied metrics and regions. Notably, the OLS model revealed a significant effect of age on MTR in the white matter (p-Age = 0.020) and in the dorsal columns (p-Age = 0.020) at spinal level C5, even when accounting for multiple comparisons. Age also demonstrated a significant correlation with the WM/GM ratio in T2\*w for all spinal level regions (p-Age = 0.007 at C2; p-Age = 0.049 at C3; p-Age = 0.022 at C4; p-Age = 0.022 at C5) after FDR correction. 

:::{figure} content/tables/table3.png

Table 3. FDR-corrected p-values for UPDRSIII and age predictors for the OLS regression model (metric = UPDRSIII + Age) 
:::

Regression plots of DTI, NODDI, MTR and T2\*w metrics with respect to age for PD subjects and HC are provided in the supplementary material, across all spinal cord subregions and spinal levels. These figures show that the progression of values with age follows a very similar trend in both HC and PD subjects across all metrics and regions. This makes it challenging to differentiate between HC and PD subjects based solely on age-related changes. However, the observed trends, such as an increase in ODI and a decrease in FA, align with findings from previous studies investigating age-related changes in these metrics in healthy individuals [@agosta_evidence_2007; @vedantam_diffusion_2014; @wang_age-related_2014]. 

# Discussion 

Based upon our ANOVA analysis, significant differences between HC and some PD groups were identified, notably between HC and the advanced PD group for FA in the WM, as well as between HC and the mid PD group in WM for RD. Our results also suggest an increase in ODI, FISO and FICVF as well as a decrease in FA with an increasing UPDRSIII score, which may be attributed to the accumulation of α-synuclein, which has been reported to cause axonal swelling [@sekigawa_role_2015], leading to greater neurite orientation dispersion and reduced diffusion anisotropy. However, since the trends observed in relation to the UPDRSIII score were not significant for any of the metrics after correcting for multiple comparisons, conclusive interpretations cannot be made based on the current study. 

Some studies have also investigated the presence of α-synuclein in the spinal cord of individuals without an antemortem diagnosis of PD and without any PD-related symptoms prior to death [@bloch_-synuclein_2006; @buchman_spinal_2017; @oinas_-synuclein_2010; @sumikura_distribution_2015]. Their findings suggest that α-synuclein is relatively common in older adults without a diagnosis of PD, raising the possibility that its presence may serve as a preclinical marker of PD or related disorders, and contributing to a debate over whether such pathology reflects prodromal PD or incidental, non-pathogenic findings. Nonetheless, this may make it even more challenging to distinguish between HC and individuals with a clinical diagnosis of PD, since α-synuclein may also be present in older HC subjects in our cohort without clinical manifestation of the disease. 

In our work, we have observed an increase in ODI and decrease in FA in the cervical spinal cord in both HC and PD subjects. These results are consistent with work from other research groups that have explored the effect of age on these DWI metrics in healthy subjects [@agosta_evidence_2007]. [@agosta_evidence_2007] have also reported no significant correlation between MD and age, which is also consistent with our findings. Other work with PD in the brain have also reported a negative correlation of FA with age in the substantia nigra [@de_oliveira_utility_2021]. 

Our current study also revealed similar effects of age on our metrics as those observed with the UPDRSIII. In some regions and metrics, such as in the WM/GM in T2\*w, our analysis revealed a stronger effect of age than the UPDRSIII on our metrics. This makes it difficult to differentiate between the effects of Parkinson’s disease progression and normal aging. Additionally, while age was included in the analysis, other potential confounding variables that could impact the progression of the disease, such as medication, should be considered in future work. 

Previous work have demonstrated relevance for the WM/GM in T2\*w as a potential biomarker for spinal cord white matter injury, such as in the case of degenerative cervical myelopathy [@martin_novel_2017]. To our knowledge, this study is the first to have explored its potential for PD in the spinal cord. However, our analysis did not reveal a significant correlation between the UPDRSIII and the WM/GM in T2\*w. Further research will be necessary to establish definitive conclusions regarding its applicability in PD. 

Finally, in the current study, it was difficult to relate our findings for structural MRI in the spinal cord microstructure with those observed with functional MRI in [@landelle_altered_2023] using the same subjects. In their work, [@landelle_altered_2023] found a decrease in functional connectivity that correlated with upper limb motor symptoms in between PD patients between C4 and C6 spinal levels. However, our analysis did not reveal any significant microstructural findings that could be associated with the functional changes described in their work.

Our analysis of spinal cord cross-sectional area (CSA) aligns with the findings of [@combes_spiral_2024], as we observed no structural changes due to PD. Indeed, our study revealed no significant differences in CSA between Parkinson’s disease (PD) subjects and healthy controls (HC). Additionally, no significant relationship between the UPDRSIII score and CSA was found. This absence of structural changes could explain the lack of significant correlations between PD and the examined MRI-derived metrics at the microstructural level. Furthermore, the evidence of no structural and microstructural changes within the gray matter may reinforce the findings of [@landelle_altered_2023] observed through functional MRI, by suggesting that the effects of PD progression reported in their study were primarily driven by functional changes in the spinal cord rather than anatomical alterations. Nevertheless, subsequent work will be needed to confirm this. 

# Conclusion

In summary, this work is the first to have studied DTI, NODDI, MTR and T2\*w metrics in the cervical spinal cord of a population with PD. Although some significant microstructural differences were identified between HC and PD subjects in isolated regions of the spinal cord—notably for FA and RD  in the white matter — no significant changes in microstructural metrics were found in relation to the UPDRSIII score. Our results also suggest that age may have a greater effect on DTI, NODDI, MTR and T2\*w metrics than the UPDRSIII in some regions of the cervical spinal cord. Our lack of significant findings in this current study suggest that the functional changes observed in the spinal cord of the same subjects in [@landelle_altered_2023] may be more sensitive markers that correlate with disease progression as assessed by clinical measures, such as UPDRSIII, than the structural measurements. This is consistent with findings from a mixed EEG-MRI study which reported reduced functional connectivity between superior and middle frontal gyrus and paracentral lobule in PD patients relative to healthy controls during an oddball auditory task, while no structural differences were observed in the DTI metrics between the same regions [@droby_interplay_2022]. 

Nonetheless, this exploratory study provides insights into how the cervical spinal cord microstructure is only slightly affected by PD, and how it compares to normal aging processes in the spinal cord. The results are also in line with those of [@combes_spiral_2024], who did not find any structural changes between PD mice and non-transgenic mice. 

# Supplementary material 

:::{figure} #suppl-fig1cell
:label: suppl-fig1

Correlations of DTI, NODDI, MTR and T2\*w with the UPDRSIII score
:::

:::{figure} #suppl-fig2cell
:label: suppl-fig2

Correlations of DTI, NODDI, MTR and T2\*w with age
:::

:::{figure} #suppl-fig3cell
:label: suppl-fig3

Correlations of CSA with (A) the UPDRSIII score and (B) with age
:::

# Acknowledgements

This work is supported by the TransMedTech Institute, thanks to the financial support of the Canada First Research Excellence Fund and the Fonds de recherche du Québec, the Fondation Courtois, the Natural Sciences and Engineering Research Council of Canada (NSERC), and Polytechnique Montreal. We thank the Clinical, Biospecimen, Imaging & Genetic (C-BIG) repository for help in participant recruitment and the brain imaging centre of The Neuro for help in data acquisition. We thank all participants involved in this study.