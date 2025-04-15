# make virtual environment and activate it
python3 -m venv venv
source venv/bin/activate
# install dependencies
pip install gaiaxpy pandas numpy

# run the script to download the data
source venv/bin/activate
python3 downloader.py

# merge files into one big binary file
cat gdr3_gaia_source_xp_extinction/*.stars >  gdr3_gaia_source_xp_extinction.stars

