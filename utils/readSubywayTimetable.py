import pandas as pd
from datetime import datetime, timedelta

sheet_names = ['수인분당선 상행(평일)', '수인분당선 하행(평일)', '수인분당선 상행(휴일)', '수인분당선 하행(휴일)']

all_data = []
for sheet_name in sheet_names:
    df = pd.read_excel(f"../dataset/수인분당선시간표.xlsx", sheet_name=sheet_name, header=[0,1, 2])
    df[[( '시발역',  '종착역',    '열차번호')]] = df[[( '시발역',  '종착역',    '열차번호')]].ffill()
    for index, row in df.iterrows():
        if row[( '시발역',  '종착역',    '열차번호')] == '죽전  ':
            arrival = row.dropna()
            departure = df.loc[index + 1].dropna()
            combined = {}
            for key, value in arrival.items():
                combined[key] = [value ,""]
            for key, value in departure.items():
                if key in combined:
                    combined[key][1] = value
                else:
                    combined[key] = ["", value]

            all_data.append( {
                "sheet_name": sheet_name,
                "combine":combined})
            break

timetables = {}
for data in all_data:
    li = []
    for key, value in data["combine"].items():
        departure_station = key[0].strip()
        arrival_station = key[1].strip()
        trainNo = key[2][:5]
        if isinstance(value[0], str) and isinstance(value[1], str):
            continue
        if isinstance(value[0], str):
            arrival_time = value[1]
        else:
            arrival_time = value[0]
        li.append({
            "departure_station": departure_station,
            "arrival_station": arrival_station,
            "trainNo": trainNo,
            "arrival_time": arrival_time.strftime("%H:%M")
        })
    if timetables.get(data["sheet_name"]) is None:
        timetables[data["sheet_name"]] = li
    else:
        timetables[data["sheet_name"]].extend(li)
    
for key, timetable in timetables.items():
    timetable.sort(
    key=lambda x: datetime.strptime(x['arrival_time'], "%H:%M") 
    + (timedelta(days=1) if 0 <= datetime.strptime(x['arrival_time'], "%H:%M").hour < 4 else timedelta())
)
    
    for entry in timetable:
        entry["lastTrain"] = False
        entry["firstTrain"] = False

    last_by_station = {}
    first_by_station = {}
    for entry in timetable:
        last_by_station[entry["arrival_station"]] = entry
        if first_by_station.get(entry["arrival_station"]) is None:
            first_by_station[entry["arrival_station"]] = entry

    for last_entry in last_by_station.values():
        last_entry["lastTrain"] = True

    for first_entry in first_by_station.values():
        first_entry["firstTrain"] = True

    for entry in timetable:
        print(f"{key}, {entry['trainNo']}, {entry['departure_station']} -> {entry['arrival_station']}, {entry['arrival_time']}, lastTrain={entry['lastTrain']}, firstTrain={entry['firstTrain']}")

import mysql.connector
from mysql.connector import Error

# MySQL 연결 설정 (환경에 맞게 수정)
DB_CONFIG = {
    "host": "localhost",
    "user": "busonda",
    "password": "FfRBECqRZNbSGm1C",
    "database": "busonda_db",
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
            CREATE TABLE IF NOT EXISTS subway_timetable (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                updn_line VARCHAR(10) NOT NULL,
                arrival_time VARCHAR(50) NOT NULL,
                train_no VARCHAR(20) NOT NULL,
                day_of_week VARCHAR(20) NOT NULL,
                first_station VARCHAR(100) NOT NULL,
                last_station VARCHAR(100) NOT NULL,
                day_count BIGINT NOT NULL,
                last_train BOOLEAN NOT NULL,
                first_train BOOLEAN NOT NULL
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
conn = get_conn()
if conn is None:
    print("❌ DB 연결 실패. 데이터를 삽입할 수 없습니다.")
else:
    try:
        cursor = conn.cursor()
        sql = '''
            INSERT INTO subway_timetable (updn_line, arrival_time, train_no, day_of_week, first_station, last_station, day_count, last_train, first_train)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        '''
        li = []
        for key, timetable in timetables.items():

            sperate = key.split(' ')[1].split('(')
            updn = sperate[0]
            day_of_week = sperate[1][:-1]
            for i, entry in enumerate(timetable):
                list_data = (updn, entry['arrival_time'], entry['trainNo'], day_of_week, entry['departure_station'], entry['arrival_station'], i+1, entry['lastTrain'], entry['firstTrain'])
                li.append(list_data)
        if not li:
            print("⚠️ 삽입할 데이터가 없습니다.")
        else:
            batch_size = 1000
            total = 0
            for i in range(0, len(li), batch_size):
                chunk = li[i:i+batch_size]
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