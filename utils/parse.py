
# 임시로 생성한 Xlsx 파일을 읽어서 정해진 형식으로 Parse 하는 코드
import pandas as pd
import os
from datetime import datetime

xlsx_names = ['24', '720-3']
sheet_names = ['월', '화', '수', '목', '금', '토', '휴일']

dfs = []
for xlsx_name in xlsx_names:
    for weekday in sheet_names:
        i = 0
        while True:
            try:
                df = pd.read_excel(f"{xlsx_name}.xlsx", sheet_name=weekday, usecols=[i, i + 1, i + 2, i + 3], names=['정류장', '예상시간표', '가장빠른', '가장늦은'])
                df[['정류장']] = df[['정류장']].ffill().dropna(axis=1, how='all')
                df['요일'] = weekday
                df['노선번호'] = xlsx_name
                df = df.dropna()
                dfs.append(df)
                i += 5
            except:
                break

for weekday in sheet_names:
    i = 0
    while True:
        try:
            df = pd.read_excel(f"redbus.xlsx", sheet_name=weekday, usecols=[i, i + 1, i + 2, i + 3], names=['노선번호', '예상시간표', '가장빠른', '가장늦은'])
            df.iloc[0,0] = df['노선번호'][0][:-1]
            df[['노선번호']] = df[['노선번호']].ffill().dropna(axis=1, how='all')
            df['요일'] = weekday
            df['정류장'] = "정문"
            df = df.dropna()
            dfs.append(df)
            i += 5
        except:
            break
for weekday in sheet_names:
    i = 0
    while True:
        try:
            df = pd.read_excel(f"maindoor.xlsx", sheet_name=weekday, usecols=[i, i + 1, i + 2, i + 3], names=['노선번호', '예상시간표', '가장빠른', '가장늦은'])
            df.iloc[0,0] = df['노선번호'][0][:-1]
            df[['노선번호']] = df[['노선번호']].ffill().dropna(axis=1, how='all')
            df['요일'] = weekday
            df['정류장'] = "정문"
            df = df.dropna()
            dfs.append(df)
            i += 5
        except:
            break

for weekday in sheet_names:
    i = 0
    while True:
        try:
            df = pd.read_excel(f"shuttle.xlsx", sheet_name=weekday, usecols=[i, i + 1, i + 2, i + 3], names=['정류장', '예상시간표', '가장빠른', '가장늦은'])
            df[['정류장']] = df[['정류장']].ffill().dropna(axis=1, how='all')
            df['요일'] = weekday
            df['노선번호'] = "셔틀버스"
            df['가장빠른'] = df['예상시간표']
            df['가장늦은'] = df['예상시간표']
            df = df.dropna()
            dfs.append(df)
            i += 5
        except:
            break

df = pd.concat(dfs).reset_index(drop=True)
station_name_map = {
    '상경관': '인문상경',
    '인문상경관': '인문상경',
    '인문,상경관': '인문상경'
}
df['정류장'] = df['정류장'].replace(station_name_map)


station_name_mapping = {
    '치과병원' : '치과병원',
    '종합실험동' : '종합실험동',
    '곰상' : '평화의광장',
    '죽전역' : '죽전역',
    '인문상경' : '인문관',
    '정문' : '정문'
}

df['정류장'] = df['정류장'].replace(station_name_mapping)
print(set(df['정류장'].values))
df.to_csv("버스시간DB.csv", index=False)