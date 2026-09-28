"""Regulator files for the ETF registry, built the way the regulators ship them.

The column sets come from the adapter's own header checks, so a file built
here is one the reader accepts — and a test that drops a column proves it
would refuse one.
"""

import csv
import io
import zipfile
from pathlib import Path

from app.modules.market_data.adapters.etf_filings import NCEN_COLUMNS

IVV_LEI = '5493007M4YMN8XL48C14'
ISHARES_TRUST_LEI = '5493000860OXIC4B5K91'
BFA_LEI = '549300YOOGP0Y1M95C20'
#: Filed by Amplify for one of its series; any LEI of its own would do.
CNBS_LEI = '529900AIXCWKEFWLQB79'


def tsv(columns, rows) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(columns), delimiter='\t')
    writer.writeheader()
    for row in rows:
        writer.writerow({column: row.get(column, '') for column in columns})
    return buffer.getvalue()


def ncen_zip(path: Path, tables: dict[str, list[dict]], *, drop_column: str = '') -> Path:
    with zipfile.ZipFile(path, 'w') as archive:
        for member, columns in NCEN_COLUMNS.items():
            header = [column for column in columns if column != drop_column]
            archive.writestr(member, tsv(header, tables.get(member, [])))
    return path


def filing(accession, *, period, filed, form='N-1A', trust_lei=ISHARES_TRUST_LEI):
    return {
        'SUBMISSION.tsv': [
            {
                'ACCESSION_NUMBER': accession,
                'REPORT_ENDING_PERIOD': period,
                'FILING_DATE': filed,
            }
        ],
        'REGISTRANT.tsv': [
            {
                'ACCESSION_NUMBER': accession,
                'REGISTRANT_NAME': 'iShares Trust',
                'CIK': '1100663',
                'LEI': trust_lei,
                'COUNTRY': 'US',
                'INVESTMENT_COMPANY_TYPE': form,
            }
        ],
    }


def fund(accession, fund_id, series, name, **fields):
    return {
        'FUND_ID': fund_id,
        'ACCESSION_NUMBER': accession,
        'FUND_NAME': name,
        'SERIES_ID': series,
        'LEI': fields.get('lei', IVV_LEI),
        'IS_ETF': fields.get('etf', 'Y'),
        'IS_INDEX': fields.get('index', ''),
        'IS_MULTI_INVERSE_INDEX': fields.get('inverse', ''),
        'IS_FUND_OF_FUND': fields.get('fof', ''),
    }


def merge(*parts):
    tables: dict[str, list[dict]] = {}
    for part in parts:
        for member, rows in part.items():
            tables.setdefault(member, []).extend(rows)
    return tables


NCEN_DOCUMENT = f"""<?xml version="1.0"?>
<edgarSubmission xmlns="http://www.sec.gov/edgar/ncen">
  <headerData><filerInfo><investmentCompanyType>N-1A</investmentCompanyType></filerInfo></headerData>
  <formData>
    <generalInfo reportEndingPeriod="2025-09-30" isReportPeriodLt12="N"/>
    <registrantInfo>
      <registrantFullName>Amplify ETF Trust</registrantFullName>
      <registrantLei>5493006EMX6222CPWJ71</registrantLei>
      <registrantcountry>US</registrantcountry>
    </registrantInfo>
    <managementInvestmentQuestionSeriesInfo>
      <managementInvestmentQuestion>
        <mgmtInvFundName>Amplify Seymour Cannabis ETF</mgmtInvFundName>
        <mgmtInvSeriesId>S000064108</mgmtInvSeriesId>
        <mgmtInvLei>{CNBS_LEI}</mgmtInvLei>
        <sharesOutstandings>
          <sharesOutstanding sharesOutstandingClassName="Amplify Seymour Cannabis ETF"
            sharesOutstandingClassId="C000207255" sharesOutstandingTickerSymbol="CNBS"/>
        </sharesOutstandings>
        <fundTypes>
          <fundType>Exchange-Traded Fund</fundType>
          <fundType>Inverse of a benchmark</fundType>
          <indexFundInfo fundType="Index Fund"/>
        </fundTypes>
        <investmentAdvisers>
          <investmentAdviser>
            <investmentAdviserName>Amplify Investments LLC</investmentAdviserName>
            <investmentAdviserLei>N/A</investmentAdviserLei>
            <investmentAdviserStateCountry investmentAdviserCountry="US"/>
          </investmentAdviser>
          <investmentAdviser>
            <investmentAdviserName>BlackRock Fund Advisors</investmentAdviserName>
            <investmentAdviserLei>{BFA_LEI}</investmentAdviserLei>
            <investmentAdviserStateCountry investmentAdviserCountry="US"/>
          </investmentAdviser>
        </investmentAdvisers>
      </managementInvestmentQuestion>
      <managementInvestmentQuestion>
        <mgmtInvFundName>A mutual fund of the same trust</mgmtInvFundName>
        <mgmtInvSeriesId>S000000009</mgmtInvSeriesId>
        <mgmtInvLei>{BFA_LEI}</mgmtInvLei>
      </managementInvestmentQuestion>
      <managementInvestmentQuestion>
        <mgmtInvFundName>Global X Interest Rate Hedge ETF</mgmtInvFundName>
        <mgmtInvSeriesId>S000076384</mgmtInvSeriesId>
        <mgmtInvLei>N/A</mgmtInvLei>
      </managementInvestmentQuestion>
    </managementInvestmentQuestionSeriesInfo>
    <etfs>
      <etf>
        <etfSeriesId>S000076384</etfSeriesId>
        <securityExchanges><securityExchange fundExchange="XNAS" fundsTickerSymbol="IRHG"/></securityExchanges>
      </etf>
    </etfs>
  </formData>
</edgarSubmission>
""".encode()


def relationships_zip(path: Path, rows: list[tuple[str, str, str]]) -> Path:
    columns = (
        'Relationship.StartNode.NodeID',
        'Relationship.EndNode.NodeID',
        'Relationship.RelationshipType',
        'Relationship.RelationshipStatus',
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(columns)
    for start, end, kind in rows:
        writer.writerow((start, end, kind, 'ACTIVE'))
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('rr.csv', buffer.getvalue())
    return path


#: The shape of an N-PORT document as EDGAR serves it, cut to three holdings:
#: two stocks and the future every S&P 500 fund carries, which has no issuer.
NPORT_DOCUMENT = b"""<?xml version="1.0"?>
<edgarSubmission xmlns="http://www.sec.gov/edgar/nport">
  <formData>
    <genInfo>
      <seriesId>S000004310</seriesId>
      <repPdDate>2026-06-30</repPdDate>
    </genInfo>
    <fundInfo>
      <totAssets>889637196076.52</totAssets>
      <netAssets>888128937468.17</netAssets>
    </fundInfo>
    <invstOrSecs>
      <invstOrSec>
        <name>Apple, Inc.</name><lei>HWUPKR0MPOU8FGXBT394</lei><title>Apple, Inc.</title>
        <cusip>037833100</cusip>
        <identifiers><isin value="US0378331005"/></identifiers>
        <balance>194050489.00</balance><units>NS</units><curCd>USD</curCd>
        <valUSD>58459530000.00</valUSD><pctVal>6.582279707468</pctVal>
        <assetCat>EC</assetCat><invCountry>US</invCountry>
      </invstOrSec>
      <invstOrSec>
        <name>NVIDIA Corp.</name><lei>549300S4KLFTLO7GSQ80</lei><title>NVIDIA Corp.</title>
        <cusip>67066G104</cusip>
        <identifiers><isin value="US67066G1040"/></identifiers>
        <balance>321773608.00</balance><units>NS</units><curCd>USD</curCd>
        <valUSD>66662000000.00</valUSD><pctVal>7.50593247848</pctVal>
        <assetCat>EC</assetCat><invCountry>US</invCountry>
      </invstOrSec>
      <invstOrSec>
        <name>N/A</name><lei>N/A</lei><title>S&amp;P 500 E-Mini Index</title><cusip>N/A</cusip>
        <identifiers><other otherDesc="Future Ticker" value="ESU6 Index"/></identifiers>
        <balance>3722.00</balance><units>NC</units><curCd>USD</curCd>
        <valUSD>13915610.94</valUSD><pctVal>0.001566845798</pctVal>
        <assetCat>DE</assetCat><invCountry>US</invCountry>
      </invstOrSec>
    </invstOrSecs>
  </formData>
</edgarSubmission>
"""
