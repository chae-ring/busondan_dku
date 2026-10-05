# 정제된 CSV 파일을 읽어서 MySQL에 삽입하는 코드
import mysql.connector
from mysql.connector import Error
import pandas as pd
from datetime import date


# MySQL 연결 설정 (환경에 맞게 수정)
DB_CONFIG = {
    "host": "127.0.0.1",
    "port" : 20000,
    "user": "root",
    "password": "1234",
    "database": "busonda_db",
    "charset": "utf8mb4",
    "use_unicode": True, 
}

def get_conn():
    """
    MySQL 연결을 반환하는 함수.
    """
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        if conn.is_connected():
            return conn
    except Error as e:
        print(f"❌ MySQL 연결 오류: {e}")
        return None
    
def init_db():
    """
    MySQL에 arrival_log 테이블이 없으면 생성하는 함수.
    """
    conn = get_conn()
    if conn is None:
        print("❌ DB 연결 실패. 테이블을 초기화할 수 없습니다.")
        return

    try:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS arrival_log (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                arrival_time VARCHAR(50) NOT NULL,
                day_of_week VARCHAR(20) NOT NULL,
                route_name VARCHAR(100) NOT NULL,
                station_name VARCHAR(100) NOT NULL,
                day_count BIGINT NOT NULL,
                plate_no VARCHAR(20) NOT NULL,
                direction VARCHAR(100)
            )
        ''')
        conn.commit()
        print(f"✅ Database '{DB_CONFIG['database']}' initialized successfully.")
    except Error as e:
        print(f"❌ 테이블 생성 오류: {e}")
    finally:
        cursor.close()
        conn.close()

init_db()
df = pd.read_csv('../dataset/버스시간DB.csv', encoding='utf-8-sig', header=0)

time_cols = ["예상시간표", "가장빠른", "가장늦은"]

today = date.today().strftime("%Y-%m-%d")

import pandas as pds
import re
from datetime import date, datetime  # datetime 객체를 직접 만들기 위해 import

def manual_time_converter(time_str):
    """
    pd.to_datetime을 쓰지 않고, 문자열을 수동으로 분해/검증하여 datetime 객체를 만듭니다.
    """
    try:
        # 1. 기본적인 전처리
        cleaned_str = str(time_str).strip().replace(';', ':')

        # 2. ':' 문자를 기준으로 문자열을 분리
        parts = cleaned_str.split(':')
        
        hour, minute, second = 0, 0, 0

        # 3. 분리된 개수에 따라 시, 분, 초를 추출
        if len(parts) == 2:  # 'HH:MM' 또는 'H:MM' 형식
            hour = int(parts[0])
            minute = int(parts[1])
            second = 0
        elif len(parts) == 3:  # 'HH:MM:SS' 형식
            hour = int(parts[0])
            minute = int(parts[1])
            second = int(parts[2])
        else:
            # 형식이 맞지 않으면 에러 발생
            raise ValueError("Incorrect format (not H:M, H:M:S)")

        # 4. 추출된 숫자가 실제 시간 범위에 맞는지 검증 (가장 중요!)
        if not (0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59):
            raise ValueError("Time value out of range (e.g., 25:00)")

        # 5. 오늘 날짜와 추출한 시/분/초를 조합하여 datetime 객체 생성
        today = date.today()
        return datetime(today.year, today.month, today.day, hour, minute, second)

    except Exception as e:
        # 6. 어떤 단계에서든 실패하면 NaT 반환 및 에러 출력
        print(f"⚠️ 변환 실패! -> 원본 값: {repr(time_str)}, 에러: {e}")
        return pd.NaT
    
# 각 열을 datetime으로 변환

for col in time_cols:
    # 문자열 변환 + 공백 제거
    df[col] = df[col].astype(str).str.strip()
    # 날짜 붙이고 변환 (초가 없어도 자동 처리)
    df[col] = df[col].apply(manual_time_converter)

print(df)
mask = df["예상시간표"].isna()
print(df[mask])   # NaT 들어간 행만 출력=
conn = get_conn()
df = df.sort_values(['요일', '노선번호', '정류장', '예상시간표'])

weekday_order = ['월', '화', '수', '목', '금', '토', '휴일']
def adjust_weekday(row):
    hour = row['예상시간표'].hour
    day = row['요일']
    
    # 새벽 0~3시는 전날 기준으로
    if hour <= 3:
        if day == '월':
            new_day = '휴일'  # 월요일 전날은 휴일 처리
        elif day == '휴일':
            new_day = '금'     # 휴일 전날은 금요일
        else:
            # 나머지는 리스트에서 하루 전
            idx = weekday_order.index(day)
            new_day = weekday_order[idx - 1]
        return new_day
    else:
        return day

import numpy as np
direction_map = {
    '치과병원': {
        '24': '단국대.평화의광장',
        '102': '단국대.치과병원',
        '8100': '단국대.치과병원',
        '1101': '단국대.치과병원',
        '31-1': '단국대정문',
        '720-3': '새봄초등학교',
        '26-3': '언동중학교',
        '39-1': '단국대.치과병원',
        '7007-1': '단국대.치과병원',
        '8100(예약)': '단국대.치과병원',
        '1101N': '단국대.치과병원',
    },
    '평화의광장': {
        '24': '죽전역.신세계사우스시티',
        '720-3': '새봄초등학교',
        '셔틀버스' : '캠퍼스 순환'
    },
    '죽전역': {
        '24': '단국대.평화의광장',
        '720-3': '단국대.치과병원',
        '셔틀버스' : '캠퍼스 순환'
    },
    '인문관': {
        '24': '죽전역.신세계사우스시티',
        '720-3': '새봄초등학교',
    },
    '종합실험동' : {
        '24': '죽전역.신세계사우스시티',
        '720-3': '새봄초등학교',
    },
    '정문': {
        '24': '죽전역.신세계사우스시티',
        '102': '건대입구역1번출구',
        '8100': '을지로입구역.광교',
        '1101': '신분당선강남역(중)',
        '31-1': '동백역3번출구',
        '720-3': '새봄초등학교',
        '26-3': '언동중학교',
        '39-1': '미금역.청솔마을.2001아울렛',
        '7007-1': '한국거래소',
        '8100(예약)': '을지로입구역.광교',
        '1101N': '신분당선강남역(중)',
    }
}

# direction 채우는 함수
def map_direction(row):
    station = row['정류장']
    route = row['노선번호']
    return direction_map.get(station, {}).get(route, np.nan)

df['direction'] = df.apply(map_direction, axis=1)

df['요일'] = df.apply(adjust_weekday, axis=1)
df['sort_time'] = df['예상시간표'].apply(lambda x: x.hour*3600 + x.minute*60 + x.second)
df['sort_time'] += np.where(df['예상시간표'].dt.hour <= 3, 24*3600, 0)
df['day_count'] = df.sort_values(['요일', '노선번호', '정류장', 'sort_time']) \
                    .groupby(['요일', '노선번호', '정류장']) \
                    .cumcount() + 1
df['plate_no'] = df['day_count'].astype(str) 

mask = df["direction"].isna()
print(df[mask])   # direction 매핑 실패한 노선번호 출력

if conn is None:
    print("❌ DB 연결 실패. 데이터를 삽입할 수 없습니다.")
else:
    try:
        cursor = conn.cursor()
        sql = '''
            INSERT INTO arrival_log (arrival_time, day_of_week, route_name, station_name, day_count, plate_no, direction)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        '''
        data = list(df[['예상시간표', '요일', '노선번호', '정류장', 'day_count', 'plate_no', 'direction']].itertuples(index=False, name=None))
        if not data:
            print("⚠️ 삽입할 데이터가 없습니다.")
        else:
            batch_size = 1000
            total = 0
            for i in range(0, len(data), batch_size):
                chunk = data[i:i+batch_size]
                cursor.executemany(sql, chunk)
                conn.commit()
                total += cursor.rowcount
            print(f"✅ Bulk inserted {total} rows.")
    except Error as e:
        conn.rollback()
        print(f"❌ 데이터 삽입 오류: {e}")
    finally:
        cursor.close()
        conn.close()

