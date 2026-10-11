import json, joblib, numpy as np, pandas as pd, shap
import matplotlib.pyplot as plt
from scipy.special import expit
from xgboost import XGBClassifier

AGE_UPPER = [24, 29, 34, 39, 44, 49, 54, 59, 64, 69, 74, 79]       # codes 1..12; 13 = 80+
AGE_MID   = {1:21,2:27,3:32,4:37,5:42,6:47,7:52,8:57,9:62,10:67,11:72,12:77,13:82}
AGE_LABEL = {1:"18-24",2:"25-29",3:"30-34",4:"35-39",5:"40-44",6:"45-49",7:"50-54",
             8:"55-59",9:"60-64",10:"65-69",11:"70-74",12:"75-79",13:"80+"}

# BMI banding. BINS must stay identical to what the model was trained with; pd.cut is
# left-open/right-closed, so 18.5 lands in band 0, 25 in band 1, and so on.
# Note: binning a *raw* BMI above 100 yields NaN, which is why preprocess() bands the
# scaler-clipped value (bmi_c) instead. Do not band ctx["bmi"] directly.
BMI_BINS = [0, 18.5, 25, 30, 35, 100]
BMI_LABELS = ["Underweight", "Healthy weight", "Overweight",
              "Obesity, class I", "Obesity, class II or higher"]

LABEL = {"HighBP":"High blood pressure","HighChol":"High cholesterol","BMI":"Body mass index",
         "Smoker":"Smoking","Stroke":"Stroke history","HeartDiseaseorAttack":"Heart disease/attack",
         "PhysActivity":"Physical activity","Fruits":"Daily fruit","Veggies":"Daily vegetables",
         "HvyAlcoholConsump":"Heavy alcohol use","AnyHealthcare":"Healthcare access","Sex":"Sex",
         "Age":"Age group","Age_mid":"Age (years)","BMI_cat":"BMI category",
         "CardioBurden":"Cardiovascular burden","LifestyleScore":"Lifestyle score",
         "Age_BMI":"Age x BMI","HighBP_HighChol":"High BP + high cholesterol"}

ADVICE = {
 "Weight": ("Reduce body weight",
   "Modest calorie deficit with a Mediterranean-style pattern: vegetables, legumes, whole grains, nuts, fish. Cut sugary drinks and refined carbohydrates.",
   "Build up to 150 min/week of brisk walking or cycling plus 2 days of strength training. A 5-7% weight loss is a realistic first goal."),
 "PhysActivity": ("Become physically active",
   "Have a small carbohydrate-plus-protein snack before longer sessions if you feel faint.",
   "Start with 10-minute walks after meals, build to 30 min on 5 days/week, add 2 short strength sessions. Increase gradually."),
 "Fruits": ("Eat fruit daily",
   "At least one portion of whole fruit a day (apple, guava, berries, orange). Prefer whole fruit to juice.", None),
 "Veggies": ("Eat vegetables daily",
   "Fill about half your plate with non-starchy vegetables (leafy greens, beans, gourds, cabbage, broccoli) at lunch and dinner.", None),
 "Smoker": ("Stop smoking",
   "Keep healthy snacks (nuts, fruit) on hand; weight gain after quitting is a common reason for relapse.",
   "Daily walks help with cravings. Ask a doctor about cessation support."),
 "HvyAlcoholConsump": ("Cut down on alcohol",
   "Replace drinks with water, soda water or unsweetened tea; avoid sugary mixers.", None),
}
MEDICAL = {
 "HighBP": "Reduce salt, follow a DASH-style diet and walk regularly. Have your blood pressure managed by a doctor.",
 "HighChol": "Cut saturated and fried fat, add oats, beans, nuts and fish. Ask your doctor about a lipid profile and whether treatment is needed.",
}
BINARY = ["HighBP","HighChol","Smoker","Stroke","HeartDiseaseorAttack","PhysActivity",
          "Fruits","Veggies","HvyAlcoholConsump","AnyHealthcare"]


def age_to_code(age):
    for code, up in enumerate(AGE_UPPER, 1):
        if age <= up:
            return code
    return 13


def bmi_band(bmi_c):
    """Band an already-clipped BMI. Returns (code, label)."""
    code = int(pd.cut([bmi_c], BMI_BINS, labels=False)[0])
    return code, BMI_LABELS[code]


def format_feature(name, shown, age_code):
    """Plain-language rendering of one feature value for display. Hoisted from explain()
    so the API layer can reuse it for every feature, not just the top-k."""
    if name == "BMI": return f"BMI {shown[name]}"
    if name == "Age": return f"age group {AGE_LABEL[age_code]}"
    if name == "Sex": return "Male" if shown[name] == 1 else "Female"
    if name in BINARY or name in ("HighBP_HighChol",): return "Yes" if shown[name] == 1 else "No"
    return f"{shown[name]:.3g}"


class DiabetesAssistant:
    def __init__(self, model_path="model/xgb_final.json", scaler_path="model/minmax_scaler.pkl",
                 features_path="model/feature_names.json", config_path="model/pipeline_config.json"):
        self.model = XGBClassifier(); self.model.load_model(model_path)
        self.scaler = joblib.load(scaler_path)
        self.cols = json.load(open(features_path))
        self.cfg = json.load(open(config_path))
        self.explainer = shap.TreeExplainer(self.model)

    def validate(self, inp):
        need = ["age_years", "sex", "height_cm", "weight_kg"] + BINARY
        miss = [k for k in need if k not in inp or inp[k] is None]
        if miss:
            raise ValueError(f"Missing inputs: {miss}")
        inp = dict(inp)
        if not 18 <= inp["age_years"] <= 120: raise ValueError("Age must be between 18 and 120.")
        if not 120 <= inp["height_cm"] <= 230: raise ValueError("Height must be 120-230 cm.")
        if not 25 <= inp["weight_kg"] <= 300:  raise ValueError("Weight must be 25-300 kg.")
        if inp["sex"] not in (0, 1): raise ValueError("sex must be 1 (male) or 0 (female).")
        for k in BINARY:
            if inp[k] not in (0, 1): raise ValueError(f"{k} must be 0 or 1.")
        return inp

    def preprocess(self, inp):
        inp = self.validate(inp)
        bmi = inp["weight_kg"] / (inp["height_cm"] / 100) ** 2
        lo, hi = float(self.scaler.data_min_[0]), float(self.scaler.data_max_[0])
        bmi_c = float(np.clip(bmi, lo, hi))
        notes = []
        if abs(bmi - bmi_c) > 1e-9:
            notes.append(f"BMI {bmi:.1f} is outside the range the model was trained on; treated as {bmi_c:.1f}.")
        code = age_to_code(inp["age_years"])
        bmi_s, age_s = self.scaler.transform(pd.DataFrame({"BMI": [bmi_c], "Age": [code]}))[0]

        r = {k: float(inp[k]) for k in BINARY}
        r.update({"Sex": float(inp["sex"]), "BMI": bmi_s, "Age": age_s})
        r["Age_mid"] = AGE_MID[code]
        r["BMI_cat"] = pd.cut([bmi_c], BMI_BINS, labels=False)[0]
        r["CardioBurden"] = r["HighBP"] + r["HighChol"] + r["Stroke"] + r["HeartDiseaseorAttack"]
        r["LifestyleScore"] = r["PhysActivity"] + r["Fruits"] + r["Veggies"] - r["Smoker"] - r["HvyAlcoholConsump"]
        r["Age_BMI"] = age_s * bmi_s if self.cfg["age_bmi_mode"] == "scaled" else code * bmi_c
        r["HighBP_HighChol"] = r["HighBP"] * r["HighChol"]

        X = pd.DataFrame([r])[self.cols].astype(float)
        return X, {"bmi": bmi, "bmi_c": bmi_c, "age_code": code, "notes": notes}

    def tier(self, p):
        return "LOW" if p < self.cfg["tier_low"] else ("HIGH" if p >= self.cfg["tier_high"] else "MODERATE")

    def score(self, inp):
        X, _ = self.preprocess(inp)
        return float(self.model.predict_proba(X)[0, 1])

    def explain(self, inp, top_k=5, make_plot=True):
        X, ctx = self.preprocess(inp)
        sv = self.explainer(X)
        vals = sv.values[0]
        contrib = pd.Series(vals, index=self.cols)

        shown = X.iloc[0].copy()
        shown["BMI"] = round(ctx["bmi"], 1); shown["Age"] = ctx["age_code"]

        displays = {f: format_feature(f, shown, ctx["age_code"]) for f in self.cols}

        top = contrib.reindex(contrib.abs().sort_values(ascending=False).index)[:top_k]
        factors = [(LABEL.get(f, f), displays[f], float(v)) for f, v in top.items()]

        fig = None
        if make_plot:
            exp = shap.Explanation(values=vals, base_values=sv.base_values[0],
                                   data=shown.values, feature_names=[LABEL.get(c, c) for c in self.cols])
            shap.plots.waterfall(exp, max_display=10, show=False)
            fig = plt.gcf()
        return factors, contrib, displays, fig, float(sv.base_values[0])

    def recommend(self, inp, contrib, max_recs=4, weight_loss=0.05):
        inp = self.validate(inp)
        p0 = self.score(inp)
        bmi = inp["weight_kg"] / (inp["height_cm"] / 100) ** 2
        cand = [
            ("Weight", bmi >= 25, {"weight_kg": inp["weight_kg"] * (1 - weight_loss)}),
            ("PhysActivity", inp["PhysActivity"] == 0, {"PhysActivity": 1}),
            ("Fruits", inp["Fruits"] == 0, {"Fruits": 1}),
            ("Veggies", inp["Veggies"] == 0, {"Veggies": 1}),
            ("Smoker", inp["Smoker"] == 1, {"Smoker": 0}),
            ("HvyAlcoholConsump", inp["HvyAlcoholConsump"] == 1, {"HvyAlcoholConsump": 0}),
        ]
        recs = []
        for factor, unhealthy, change in cand:
            if unhealthy:
                p1 = self.score({**inp, **change})
                if p1 < p0:
                    recs.append((factor, change, p1))
        recs.sort(key=lambda t: t[2]); recs = recs[:max_recs]

        combined = {}
        for _, ch, _ in recs: combined.update(ch)
        p_all = self.score({**inp, **combined}) if recs else p0
        medical = [(k, MEDICAL[k]) for k in MEDICAL if inp[k] == 1 and contrib[k] > 0]
        return p0, recs, p_all, medical

    def report(self, inp, make_plot=True):
        X, ctx = self.preprocess(inp)
        factors, contrib, displays, fig, base_value = self.explain(inp, make_plot=make_plot)
        p0, recs, p_all, medical = self.recommend(inp, contrib)
        t = self.tier(p0)

        md = [f"## Risk score: {p0:.0%}  |  Tier: **{t}**",
              f"BMI {ctx['bmi']:.1f}  |  age group {AGE_LABEL[ctx['age_code']]}"]
        for n in ctx["notes"]:
            md.append(f"_Note: {n}_")
        md += ["", "### What is driving this score"]
        for name, val, v in factors:
            md.append(f"- {'raises' if v > 0 else 'lowers'} risk: **{name}** ({val}), impact {v:+.2f}")

        md += ["", "### Personalized plan"]
        if recs:
            for n, (factor, ch, p1) in enumerate(recs, 1):
                title, diet, ex = ADVICE[factor]
                md.append(f"**{n}. {title}**  (model score {p0:.0%} -> {p1:.0%})")
                md.append(f"- Diet: {diet}")
                if ex: md.append(f"- Exercise: {ex}")
            md.append(f"\n**If all of the above are achieved: {p0:.0%} -> {p_all:.0%}**")
        else:
            md.append("No modifiable lifestyle factor here is both unhealthy and score-reducing. Maintain your healthy habits.")

        if medical:
            md += ["", "### Factors to manage with a doctor"]
            md += [f"- **{LABEL[k]}**: {txt}" for k, txt in medical]
        if t == "HIGH":
            md += ["", "**Next step:** a high score is not a diagnosis. Ask a clinician about a confirmatory test (fasting glucose or HbA1c)."]
        md += ["", "_Decision-support only, not medical advice. Check with a doctor before starting vigorous exercise, "
                   "especially with heart disease or stroke history._"]
        return {"score": p0, "tier": t, "factors": factors, "recs": recs, "fig": fig,
                "markdown": "\n".join(md), "notes": ctx["notes"],
                # Previously computed but discarded; surfaced for the API layer.
                "p_all": p_all, "medical": medical, "displays": displays,
                "contrib": contrib, "base_value": base_value,
                "bmi": ctx["bmi"], "bmi_c": ctx["bmi_c"], "age_code": ctx["age_code"]}
