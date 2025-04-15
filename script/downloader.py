from gaiaxpy import calibrate
import pandas as pd
import numpy as np
import os
import requests
import gzip
import csv
from io import StringIO
import multiprocessing as mp
from pathlib import Path


filenames = "gdr3_gaia_source.txt"
output_folder = "gdr3_gaia_source_xp_extinction"
output_filename = lambda x: f"{output_folder}/{x}.stars"
Path(output_folder).mkdir(parents=True, exist_ok=True)

continuous_filename = lambda x: f"https://cdn.gea.esac.esa.int/Gaia/gdr3/Spectroscopy/xp_continuous_mean_spectrum/XpContinuousMeanSpectrum_{x}.csv.gz"
all_filename = lambda x: f"https://cdn.gea.esac.esa.int/Gaia/gdr3/gaia_source/GaiaSource_{x}.csv.gz"




sampling_strategy = np.arange(336, 1021, 2)

attributes = [
    ("source_id", "u8"),
    ("ra", "d"),
    ("dec", "d"),
    ("parallax", "d"),
    ("nu_eff_used_in_astrometry", "d"),
    ("pseudocolour", "d"),
    ("phot_g_mean_flux", "d"),
    ("phot_g_mean_mag", "d"),
    ("phot_bp_mean_flux", "d"),
    ("phot_bp_mean_mag", "d"),
    ("phot_rp_mean_flux", "d"),
    ("phot_rp_mean_mag", "d"),
    ("rv_template_teff", "d"),
    ("teff_gspphot", "d"),
    ("azero_gspphot", "d"),
    ("ag_gspphot", "d"),
]

def type_c_to_np(c):
    if c == "b":
        return "f"
    if c == "u8":
        return c
    if c == "d":
        return "d"
    return "f"

flux_cols = [(f"flux{i}", "d") for i in range(sampling_strategy.shape[0])]
attributes += flux_cols
typesDef = ", ".join([type_c_to_np(x[1]) for x in attributes])
columns = [x[0] for x in attributes]



column_to_convert = ['bp_coefficients',
 'bp_coefficient_errors',
 'bp_coefficient_correlations',
 'rp_coefficients',
 'rp_coefficient_errors',
 'rp_coefficient_correlations']


def convert_df(df):
    for column in column_to_convert:
        if column in df.columns:
            df[column] = df[column].apply(lambda x: np.fromstring(x[1:-1], sep=','))
            
def getDf(url):
    req = requests.get(url)
    csvStrIO = StringIO(gzip.decompress(req.content).decode())
    reader = csv.reader(csvStrIO)
    df = pd.read_csv(csvStrIO, comment='#', compression='gzip', float_precision='round_trip')
    return df


def process(currentId):
    try:
        if os.path.isfile(output_filename(currentId)): 
            print(f"{currentId} found")
            return
        print(f"starting {currentId}")
        # make dataframes
        dfa = getDf(all_filename(currentId))
        dfc = getDf(continuous_filename(currentId))
        convert_df(dfc)
        # merge
        full_data = pd.merge(dfa, dfc, left_on='source_id', right_on='source_id', how='right')
        # sample
        calibrated_df, sampling = calibrate(dfc, sampling=sampling_strategy, save_file=False)
        # merge sampled
        full_data_calibrated = pd.merge(full_data, calibrated_df, left_on='source_id', right_on='source_id', how='left')
        # extend flux cols
        print(f"extending {currentId}")
        flux_col = full_data_calibrated[full_data_calibrated["flux"].notnull()]["flux"]
        extended_flux = pd.DataFrame(flux_col.values.tolist(), index=flux_col.index, columns=[x[0] for x in flux_cols])
        outdf = pd.concat([full_data_calibrated, extended_flux], axis=1)
        # nan handling
        for c in columns:
            if np.any(outdf[c].isnull()):
                outdf.loc[outdf[c].isnull(), c] = -1
        # save
        print(f"saving {currentId} ....")
        out_list = outdf[columns].to_records(index=False)
        out_list = np.array(out_list, dtype=typesDef)
        with open(output_filename(currentId), 'wb') as f:
            f.write(out_list.tobytes())
        print(f"writing {currentId} done")
    except:
        print(f"error {currentId}")

        
if __name__ == '__main__':
    with open(filenames) as f:
        file_ids = f.read().replace("http://cdn.gea.esac.esa.int/Gaia/gdr3/gaia_source/GaiaSource_", "").replace('.csv.gz', "\n").split()
    
    import random
    random.shuffle(file_ids)
    with mp.Pool(processes = 8) as p:
        p.map(process, file_ids)

    # for file_id in file_ids:
    #     process(file_id)
