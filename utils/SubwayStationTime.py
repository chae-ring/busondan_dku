from datetime import datetime

downline = """
7:48:00
7:53:00
7:55:00
7:58:00
7:58:30
8:00:00
8:00:30
8:02:30
8:03:00
8:04:00
8:04:30
8:06:00
8:06:30
8:08:00
8:08:30
8:09:30
8:10:00
8:11:00
8:11:30
8:13:00
8:13:30
8:14:30
8:15:00
8:18:30
8:19:00
8:22:30
8:23:00
8:25:30
8:26:00
8:27:30
8:28:00
8:29:30
8:30:00
8:32:30
8:33:00
8:35:00
8:35:30
8:37:00
8:37:30
8:39:00
8:39:30
8:41:30
8:42:00
8:44:00
8:44:30
8:46:00
8:46:30
8:49:30
"""

downlineStation = """
청량리 왕십리 서울숲 압구정로데오 강남구청 선정릉 선릉 한티 도곡 구룡 개포동 대모산입구 수서 복정 가천대 태평 모란 야탑 이매 서현 수내 정자 미금 오리 죽전
"""

upline = """
5:28:00
5:29:30
5:30:00
5:32:00
5:32:30
5:34:30
5:35:00
5:37:00
5:37:30
5:40:30
5:41:00
5:42:30
5:43:00
5:44:30
5:45:00
5:46:30
5:47:00
5:48:30
5:49:00
5:50:30
5:51:00
5:52:30
5:53:00
5:55:00
5:55:30
5:58:00
5:58:30
6:01:00
6:01:30
6:04:00
6:04:30
6:07:00
6:07:30
6:09:30
6:10:00
6:12:00
6:12:30
6:14:00
6:14:30
6:16:30
6:17:30
6:20:30
6:21:30
6:25:30
6:26:00
6:28:30
6:29:00
6:33:00
6:33:30
6:35:30
6:36:00
6:39:30
6:40:00
6:42:00
6:42:30
6:44:30
6:45:00
6:47:30
6:48:00
6:50:00
6:50:30
6:52:30
6:53:00
6:54:30
6:55:00
6:58:00
6:58:30
7:00:30
7:01:00
7:03:00
7:03:30
7:05:30
7:06:00
7:08:00
7:08:30
7:10:30
"""

uplineStation = """
인천 신포 숭의 인하대 송도 연수 원인재 남동인더스파크 호구포 인천논현 소래포구 월곶 달월 오이도 정왕 신길온천 안산 초지 고잔 중앙 한대앞 사리 야목 어천 오목천 고색 수원 매교 수원시청 매탄권선 망포 영통 청명 상갈 기흥 신갈 구성 보정 죽전
"""

print(len(downline.strip().split("\n")))
print(uplineStation.split())

upline_times = upline.split()
upline_stations = uplineStation.split()

li_up = []

firstTime = datetime.strptime(upline_times[0], "%H:%M:%S")
li_up.append({
    "updnLine": "상행",
    "delta" : "출발",
    "stations": upline_stations[0],
    "timedelta": (datetime.strptime(upline_times[0], "%H:%M:%S") - firstTime).total_seconds()
})

j = 1
for i in range(1, len(upline_stations)):
    li_up.append({
        "updnLine": "상행",
        "delta" : "도착",
        "stations": upline_stations[i],
        "timedelta": (datetime.strptime(upline_times[j], "%H:%M:%S") - firstTime).total_seconds()
    })
    if i == len(upline_stations) -1:
        break
    li_up.append({
        "updnLine": "상행",
        "delta" : "출발",
        "stations": upline_stations[i],
        "timedelta": (datetime.strptime(upline_times[j + 1], "%H:%M:%S") - firstTime).total_seconds()
    })
    j += 2

print(*li_up, sep="\n")


downline_times = downline.split()
downline_stations = downlineStation.split()

li_down = []

firstTime = datetime.strptime(downline_times[0], "%H:%M:%S")
li_down.append({
    "updnLine": "하행",
    "delta" : "출발",
    "stations": downline_stations[0],
    "timedelta": (datetime.strptime(downline_times[0], "%H:%M:%S") - firstTime).total_seconds()
})

j = 1
for i in range(1, len(downline_stations)):
    li_down.append({
        "updnLine": "하행",
        "delta" : "도착",
        "stations": downline_stations[i],
        "timedelta": (datetime.strptime(downline_times[j], "%H:%M:%S") - firstTime).total_seconds()
    })
    if i == len(downline_stations) -1:
        break
    li_down.append({
        "updnLine": "하행",
        "delta" : "출발",
        "stations": downline_stations[i],
        "timedelta": (datetime.strptime(downline_times[j + 1], "%H:%M:%S") - firstTime).total_seconds()
    })
    j += 2

print(*li_down, sep="\n")


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
            CREATE TABLE IF NOT EXISTS subway_timedelta (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                updn_line VARCHAR(10) NOT NULL,
                delta VARCHAR(10) NOT NULL,
                station_name VARCHAR(100) NOT NULL,
                timedelta BIGINT NOT NULL
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
            INSERT INTO subway_timedelta (updn_line, delta, station_name, timedelta)
            VALUES (%s, %s, %s, %s)
        '''
        li = []
        for item in li_down + li_up:
            li.append((
                item['updnLine'],
                item['delta'],
                item['stations'],
                item['timedelta']
            ))
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
