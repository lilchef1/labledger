"""Rating thresholds for soil analytes.

Each entry defines the breakpoints and labels for the rating bar.
The highlight logic: find the first bucket where the value fits.
"""


def _parse_value(value):
    if value is None or (isinstance(value, float) and value != value):
        return None
    s = str(value).strip()
    if s.startswith("<") or s.startswith(">"):
        try:
            return float(s[1:])
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None


def rate_value(value, thresholds):
    """Return the index (0-based) of the rating bucket the value falls into.

    thresholds is a list of (label, test_func) pairs ordered left to right.
    Returns None if value is missing or no bucket matches.
    """
    num = _parse_value(value)
    if num is None:
        return None
    for i, (label, test) in enumerate(thresholds):
        if test(num):
            return i
    return None


PH_RATINGS = [
    ("Strongly Acid", "<5.4", lambda v: v < 5.4),
    ("Moderately Acid", "5.4-5.7", lambda v: 5.4 <= v <= 5.7),
    ("Slightly Acid", "5.8-6.4", lambda v: 5.8 <= v <= 6.4),
    ("Neutral", "6.5-7.2", lambda v: 6.5 <= v <= 7.2),
    ("Slightly Alkaline", "7.3-7.6", lambda v: 7.3 <= v <= 7.6),
    ("Moderately Alkaline", "7.7-7.9", lambda v: 7.7 <= v <= 7.9),
    ("Strongly Alkaline", ">7.9", lambda v: v > 7.9),
]

EC_RATINGS = [
    ("Very Low", "<0.2", lambda v: v < 0.2),
    ("Low", "0.2-0.7", lambda v: 0.2 <= v <= 0.7),
    ("Moderate", "0.8-1.2", lambda v: 0.8 <= v <= 1.2),
    ("Moderately High", "1.3-2.5", lambda v: 1.3 <= v <= 2.5),
    ("High", "2.6-5.0", lambda v: 2.6 <= v <= 5.0),
    ("Very High", ">5.0", lambda v: v > 5.0),
]

OM_RATINGS = [
    ("Very Low", "<0.5", lambda v: v < 0.5),
    ("Low", "0.5-1.5", lambda v: 0.5 <= v <= 1.5),
    ("Medium", "1.6-3.0", lambda v: 1.6 <= v <= 3.0),
    ("High", "3.1-5.0", lambda v: 3.1 <= v <= 5.0),
    ("Very High", ">5.0", lambda v: v > 5.0),
]

NITRATE_RATINGS = [
    ("Very Low", "<5", lambda v: v < 5),
    ("Low", "5-10", lambda v: 5 <= v <= 10),
    ("Medium", "11-25", lambda v: 11 <= v <= 25),
    ("High", "26-50", lambda v: 26 <= v <= 50),
    ("Very High", ">50", lambda v: v > 50),
]

PHOSPHORUS_RATINGS = [
    ("Very Low", "0-3", lambda v: v <= 3),
    ("Low", "4-6", lambda v: 4 <= v <= 6),
    ("Medium", "7-10", lambda v: 7 <= v <= 10),
    ("Optimum", "11-15", lambda v: 11 <= v <= 15),
    ("High", "16-20", lambda v: 16 <= v <= 20),
    ("Very High", ">20", lambda v: v > 20),
]

POTASSIUM_RATINGS = [
    ("Very Low", "<60", lambda v: v < 60),
    ("Low", "60-120", lambda v: 60 <= v <= 120),
    ("Medium", "121-160", lambda v: 121 <= v <= 160),
    ("Optimum", "161-220", lambda v: 161 <= v <= 220),
    ("High", "221-280", lambda v: 221 <= v <= 280),
    ("Very High", ">280", lambda v: v > 280),
]

CALCIUM_RATINGS = [
    ("Very Low", "<100", lambda v: v < 100),
    ("Low", "100-200", lambda v: 100 <= v <= 200),
    ("Medium", "201-300", lambda v: 201 <= v <= 300),
    ("Optimum", "301-2500", lambda v: 301 <= v <= 2500),
    ("High", ">2500", lambda v: 2500 < v <= 5000),
    ("Very High", ">5000", lambda v: v > 5000),
]

MAGNESIUM_RATINGS = [
    ("Very Low", "<25", lambda v: v < 25),
    ("Low", "25-50", lambda v: 25 <= v <= 50),
    ("Medium", "51-75", lambda v: 51 <= v <= 75),
    ("Optimum", "75-100", lambda v: 75 < v <= 100),
    ("High", "100-200", lambda v: 100 < v <= 200),
    ("Very High", ">200", lambda v: v > 200),
]

CEC_RATINGS = [
    ("Sand", "3-10", lambda v: 3 <= v < 10),
    ("Loam", "10-15", lambda v: 10 <= v < 15),
    ("Silt Loams", "15-25", lambda v: 15 <= v < 25),
    ("Clay & Clay Loam", "25-50", lambda v: 25 <= v < 50),
    ("Organic Soils", "50-100", lambda v: 50 <= v <= 100),
]

SULFATE_RATINGS = [
    ("Very Low", "<2", lambda v: v < 2),
    ("Low", "2-5", lambda v: 2 <= v <= 5),
    ("Medium", "6-10", lambda v: 6 <= v <= 10),
    ("Optimum", "11-15", lambda v: 11 <= v <= 15),
    ("High", ">15", lambda v: v > 15),
]

ZINC_RATINGS = [
    ("Very Low", "<0.3", lambda v: v < 0.3),
    ("Low", "0.3-0.5", lambda v: 0.3 <= v <= 0.5),
    ("Medium", "0.6-0.8", lambda v: 0.6 <= v <= 0.8),
    ("Optimum", "0.9-1.2", lambda v: 0.9 <= v <= 1.2),
    ("High", "1.3-2.0", lambda v: 1.3 <= v <= 2.0),
    ("Very High", ">2.0", lambda v: v > 2.0),
]

IRON_RATINGS = [
    ("Very Low", "<1.0", lambda v: v < 1.0),
    ("Low", "1.0-2.5", lambda v: 1.0 <= v <= 2.5),
    ("Medium", "2.6-5.0", lambda v: 2.6 <= v <= 5.0),
    ("Optimum", "5.1-15.0", lambda v: 5.1 <= v <= 15.0),
    ("High", "15.1-30", lambda v: 15.1 <= v <= 30),
    ("Very High", ">30", lambda v: v > 30),
]

MANGANESE_RATINGS = [
    ("Very Low", "<0.5", lambda v: v < 0.5),
    ("Low", "0.5-1.0", lambda v: 0.5 <= v <= 1.0),
    ("Medium", "1.1-3.0", lambda v: 1.1 <= v <= 3.0),
    ("Optimum", "3.1-6.0", lambda v: 3.1 <= v <= 6.0),
    ("High", "6.1-10.0", lambda v: 6.1 <= v <= 10.0),
    ("Very High", ">10", lambda v: v > 10),
]

COPPER_RATINGS = [
    ("Very Low", "<0.1", lambda v: v < 0.1),
    ("Low", "0.1-0.2", lambda v: 0.1 <= v <= 0.2),
    ("Medium", "0.3-0.4", lambda v: 0.3 <= v <= 0.4),
    ("Optimum", "0.5-0.8", lambda v: 0.5 <= v <= 0.8),
    ("High", "0.9-1.5", lambda v: 0.9 <= v <= 1.5),
    ("Very High", ">1.5", lambda v: v > 1.5),
]

BORON_RATINGS = [
    ("Very Low", "<0.2", lambda v: v < 0.2),
    ("Low", "0.2-0.5", lambda v: 0.2 <= v <= 0.5),
    ("Medium", "0.6-0.8", lambda v: 0.6 <= v <= 0.8),
    ("Optimum", "0.9-1.5", lambda v: 0.9 <= v <= 1.5),
    ("High", "1.6-2.5", lambda v: 1.6 <= v <= 2.5),
    ("Very High", ">2.5", lambda v: v > 2.5),
]


def get_rating_index(analyte_key, value):
    """Return the 0-based index of the highlighted rating bucket."""
    ratings_map = {
        "pH": PH_RATINGS,
        "EC": EC_RATINGS,
        "OM": OM_RATINGS,
        "Nitrate": NITRATE_RATINGS,
        "P": PHOSPHORUS_RATINGS,
        "K": POTASSIUM_RATINGS,
        "Ca": CALCIUM_RATINGS,
        "Mg": MAGNESIUM_RATINGS,
        "CEC": CEC_RATINGS,
        "S": SULFATE_RATINGS,
        "Zn": ZINC_RATINGS,
        "Fe": IRON_RATINGS,
        "Mn": MANGANESE_RATINGS,
        "Cu": COPPER_RATINGS,
        "B": BORON_RATINGS,
    }
    ratings = ratings_map.get(analyte_key)
    if ratings is None:
        return None
    thresholds = [(label, test) for label, _range, test in ratings]
    return rate_value(value, thresholds)


def get_rating_labels(analyte_key):
    """Return list of (label, range_text) for the rating bar columns."""
    ratings_map = {
        "pH": PH_RATINGS,
        "EC": EC_RATINGS,
        "OM": OM_RATINGS,
        "Nitrate": NITRATE_RATINGS,
        "P": PHOSPHORUS_RATINGS,
        "K": POTASSIUM_RATINGS,
        "Ca": CALCIUM_RATINGS,
        "Mg": MAGNESIUM_RATINGS,
        "CEC": CEC_RATINGS,
        "S": SULFATE_RATINGS,
        "Zn": ZINC_RATINGS,
        "Fe": IRON_RATINGS,
        "Mn": MANGANESE_RATINGS,
        "Cu": COPPER_RATINGS,
        "B": BORON_RATINGS,
    }
    ratings = ratings_map.get(analyte_key, [])
    return [(label, range_text) for label, range_text, _test in ratings]


def needs_woodruff(ph_value):
    num = _parse_value(ph_value)
    if num is None:
        return False
    return num < 6.2


def get_recommendation(analyte_key, value, crop_hort=None, plant_type=None,
                       soil_depth=None, nitrate_value=None):
    """Determine if an analyte needs recommendations.

    Returns 'Needs Recs', '0', or '' based on the Excel formula logic.
    """
    num = _parse_value(value)
    if value is None or (isinstance(value, float) and value != value):
        return ""

    value_str = str(value).strip()
    is_below_detect = value_str in ("<1", "<0.01")

    rec_thresholds = {
        "P": lambda v, bd: bd or v <= 11,
        "K": lambda v, bd: bd or v <= 161,
        "Ca": lambda v, bd: bd or v <= 301,
        "Mg": lambda v, bd: bd or v <= 75,
        "S": lambda v, bd: bd or v <= 10,
        "Zn": lambda v, bd: bd or v <= 0.9,
        "Fe": lambda v, bd: bd or v <= 5.1,
        "Mn": lambda v, bd: bd or v <= 3.1,
        "Cu": lambda v, bd: bd or v < 0.449,
    }

    check = rec_thresholds.get(analyte_key)
    if check is None:
        return ""
    if num is None and not is_below_detect:
        return ""
    if check(num if num is not None else 0, is_below_detect):
        return "Needs Recs"
    return "0"
