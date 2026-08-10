import datetime
import bcrypt
from sqlalchemy.orm import Session
from backend.database import engine, Base, SessionLocal
from backend.models import Department, Section, Student, User, AcademicYear, LeetCodeProfileStats, WeeklySession, WeeklySessionSnapshot, WeeklyStudentProgress
from backend.leetcode_client import extract_leetcode_username

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

# III Year CSE(CS) Students (63 records)
III_YEAR_CSE_CS = [
    ("732224CC001", "AJAY A", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Ajay_A1277/"),
    ("732224CC002", "AMRUTHA M", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Ammu1927/"),
    ("732224CC003", "ANUSHKUMAR R", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/anushkumar_06/"),
    ("732224CC004", "BHARATH G", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/BHARATH1927/"),
    ("732224CC005", "DHANUSHYA G K", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/dhanu2006/"),
    ("732224CC006", "DHARSHINI A M", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/DHARSHINI_1605/"),
    ("732224CC007", "DHARSHINI S M", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Dharshini90989/"),
    ("732224CC008", "DHARUNRAJ K P", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/K_P_DHARUNRAJ/"),
    ("732224CC009", "GIRIPATHI K", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Giripathi_k/"),
    ("732224CC010", "GOKUL P", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/gokul_5405/"),
    ("732224CC011", "HARDIKA M", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/hardi22011/"),
    ("732224CC012", "HARIHARAN S V", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/x8ggzaR6Gx/"),
    ("732224CC013", "HARISH K", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Harish000007/"),
    ("732224CC014", "HARISH KUMAAR S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/HarishVichu/"),
    ("732224CC015", "HARISH N", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Har-ish23/"),
    ("732224CC016", "INIYA K", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Iniya3126/"),
    ("732224CC017", "JANANI S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/_itz_pretty/"),
    ("732224CC018", "JAYAPRAKASH S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/jayaprakash2007/"),
    ("732224CC019", "JAYASURYA S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Surya1231172/"),
    ("732224CC020", "KARTHIKEYAN V", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/karthi_2007/"),
    ("732224CC021", "KIRUTHIKAA P T", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/success_lover_01/"),
    ("732224CC022", "KISHORE C", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/KISHORE_CHAND/"),
    ("732224CC023", "LAKSANA S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Laksana_Subramanian/"),
    ("732224CC024", "MADAN PRASATH G", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/login/MADAN__200/"),
    ("732224CC025", "MAGUDAPATHI S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/XDb4OxGxp6/"),
    ("732224CC026", "MAHILNETHRA S K", "CSE(CS)", "III", "NEC", "", "http://leetcode.com/u/mahilnethra/"),
    ("732224CC027", "MANJUNATH D", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/M1c4D2Ur5h/"),
    ("732224CC028", "MANOJ KUMAR C", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/ManojKumar2315/"),
    ("732224CC029", "MOHAMED THARIQ J", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Thariq2525/"),
    ("732224CC031", "NANTHISH S", "CSE(CS)", "III", "NEC", "nanthishvaran17@gmail.com", "https://leetcode.com/u/nanthishvaran_07/"),
    ("732224CC032", "NISHANTH J S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Nishanthjs/"),
    ("732224CC033", "NITHIN S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/nithin_31_/"),
    ("732224CC034", "NIVETHYTHA JR R", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Nivethytha0704/"),
    ("732224CC035", "POOMITHA KS", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/sahasri_04/"),
    ("732224CC036", "PRASATH R", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/prasath00156/"),
    ("732224CC037", "PRITHIKA P", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Pritss2206/"),
    ("732224CC038", "RADHISRI N", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Radhisri28/"),
    ("732224CC039", "RAJESH R", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Rajesh1328/"),
    ("732224CC040", "RITHANIKA V", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Rithanika_Venakatac/"),
    ("732224CC041", "RITHIKA J", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Rithu16122006/"),
    ("732224CC042", "ROHITH R", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Rohith_2682006/"),
    ("732224CC043", "SABARI N", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/sabari43/"),
    ("732224CC044", "SAKTHI S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/s8oyP1SH73/"),
    ("732224CC045", "SHANDEESH R P", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/shandeeshrp/"),
    ("732224CC046", "SHANMUGA PRIYA J", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Priya_1410/"),
    ("732224CC047", "SHARMILA P", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/rFIIQ4f2JS/"),
    ("732224CC048", "SOWMIYA S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/DJyWNuZj4N/"),
    ("732224CC049", "SRISELVAN P", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/SriselvanP/"),
    ("732224CC050", "SUBA SRI B", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/suba_sri10/"),
    ("732224CC051", "SUBASH MURUGAN S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/subashmurugan212/"),
    ("732224CC052", "SUPRIYA K", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/SUPRIYA_2601/"),
    ("732224CC053", "SURESH S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/suresh11092006/"),
    ("732224CC054", "VARSHINI DEVI K", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/varshini_devi2006/"),
    ("732224CC055", "VEDHASREE P", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/vedhasree_2006/"),
    ("732224CC056", "VIGNESH T", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/vignesh_1112/"),
    ("732224CC057", "VISHAANTH M B", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/vishaanth0007/"),
    ("732224CC058", "YAZHINI SHREE A", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/yazhu_shree/"),
    ("732224CC059", "YURJEEN J", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Yurjeen26/"),
    ("732224CC060", "YUVANESH S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/V0mg69rzpB/"),
    ("732224CCL01", "MOHAMMED AFFAN.JA", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Mohammed_Affan_J/"),
    ("732224CCL02", "SARAN.R", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/Saranraj_2580/"),
    ("732224CCL03", "SHREE SANJAY U K", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/shreesanjay/"),
    ("732224CCL04", "SRIDHAR S", "CSE(CS)", "III", "NEC", "", "https://leetcode.com/u/sridhar320076/"),
]

# II Year CSE(CS) Students (68 records)
II_YEAR_CSE_CS = [
    ("732225CC001", "AARATHANA L", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/LQatII0XhaQ/"),
    ("732225CC002", "AARSIKA M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Aarsika_M"),
    ("732225CC003", "ABHISHEK M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/abhishek_cc003"),
    ("732225CC004", "ABINAYA S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Abi_CC004/"),
    ("732225CC005", "ASHVIK AKHIL RAJAN R", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/ASHVIKAKILRAJAN/"),
    ("732225CC006", "DEEPAK T", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/0MGVasBmsd/"),
    ("732225CC007", "DEEPIKA G L", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/iXZMxOzqMf/"),
    ("732225CC008", "DHARANEESH SABARI N", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/8Fr8Zz0vdVq/"),
    ("732225CC009", "DHARSHAN G", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/dharshang2007/"),
    ("732225CC010", "DIVYANAND G R", "CSE(CS)", "II", "A", "", "https://leetcode.com/problemset/"),
    ("732225CC011", "FARVAESH MUSHRAF M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/6oyrbP7Cn"),
    ("732225CC012", "GAYATHIRIDEVI P", "CSE(CS)", "II", "A", "", ""),
    ("732225CC013", "GIBSON KENLEY S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/n1J49Ovita"),
    ("732225CC014", "GOKULRAJ R", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Gokulraj14/"),
    ("732225CC015", "GOWRIPRIYA M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/81JUyQRRqL/"),
    ("732225CC016", "HARISH B", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/732225CC016/"),
    ("732225CC017", "HARISH M S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/harishms2007/"),
    ("732225CC018", "JANARTHANAN R", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/jana777/"),
    ("732225CC019", "JAYASRI R", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Jayasri3103"),
    ("732225CC020", "JAYEL CHRISTINA SCUDD", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Jayel_18/"),
    ("732225CC021", "JEBARSON K", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/7RHM08kNyY"),
    ("732225CC022", "JEEVITHA S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Jeevi_AlgoQueen/"),
    ("732225CC023", "KARMUGIL V", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/p4J1zKdZXp/"),
    ("732225CC024", "KAVI PRIYA T", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/rBjc1qgtsB/"),
    ("732225CC025", "KAVIN B", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/65lGBoRTZN/"),
    ("732225CC026", "KEERTHEESH K R", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/keertheesh/"),
    ("732225CC027", "KEERTHI RAJA S", "CSE(CS)", "II", "A", "", "https://leetcode.com/profile/account/"),
    ("732225CC028", "LALITHKUMAR B V", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/LalithKumar19"),
    ("732225CC029", "LIGITH SANJAY G", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/cbZx47N2Af/"),
    ("732225CC030", "MIDESH K P", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/midesh_123/"),
    ("732225CC031", "MOUNESH G", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/j01UT4oM0T/"),
    ("732225CC032", "MUKESH S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Mukeshmukesh123"),
    ("732225CC033", "NAVASAKTHI K K", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Nava_sakthi/"),
    ("732225CC034", "NAVEEN R", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/HR1IfJuaDf/"),
    ("732225CC035", "NIVETHAA S B", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/nivethaa_baskaran"),
    ("732225CC036", "POOVARASU A", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/POOVARASU_"),
    ("732225CC037", "PRADEEPA M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/PradeepaM_/"),
    ("732225CC038", "PRIYADHARSHINI D", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Priyaa_27/"),
    ("732225CC039", "PRIYADHARSHINI G", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/f0Gm3IZrgv/"),
    ("732225CC040", "PRIYADHARSHINI P", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/mn6vcyWJAN/"),
    ("732225CC041", "RAJABALAN B", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/RAJABALAN_B/"),
    ("732225CC042", "RAVIBHARATHI R", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/RaviBharathi1234/"),
    ("732225CC043", "ROKITHKISHOR R S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/ROKITHKISHOR"),
    ("732225CC044", "SABARI T", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/sabari_044/"),
    ("732225CC045", "SAHANAJ BANU M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/sahanajbanu/"),
    ("732225CC046", "SAJAN VENKAT M", "CSE(CS)", "II", "A", "", "https://leetcode.com/contest/weekly-contest"),
    ("732225CC047", "SANTHOSH M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/ZAWXjcjOUw"),
    ("732225CC048", "SARATHY S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/m2gQcjuz57/"),
    ("732225CC049", "SASINESAN T", "CSE(CS)", "II", "A", "", "https://leetcode.com/problemset/"),
    ("732225CC050", "SHRUTI S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/rMkHpSQTH6/"),
    ("732225CC051", "SIDDHDEV V R", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/SIDDHDEV/"),
    ("732225CC052", "STALIN A", "CSE(CS)", "II", "A", "", "https://leetcode.com/profile/account/"),
    ("732225CC053", "SUBILNATH G", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/WbcKc8koB8"),
    ("732225CC054", "SUJITH A", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Sujithnandha/"),
    ("732225CC055", "SURUTHI S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/YI7QFq600/"),
    ("732225CC056", "SUSITHA U", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/XXqTDMCg8v/"),
    ("732225CC057", "SUVATHI V", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/00uzqPrwKt/"),
    ("732225CC058", "SWETHA JAYASIKA P", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/aUkFZZq7AJ/"),
    ("732225CC059", "TAMILARASAN S", "CSE(CS)", "II", "A", "", "https://leetcode.com/problemset/"),
    ("732225CC060", "THARANYA L", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/tharanya008/"),
    ("732225CC061", "VETRIVEL G", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/2M4WMu7ICq/"),
    ("732225CC062", "YOGESH P", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/YOGESH_062/"),
    ("732225CCL01", "ANVAR AHAMED S", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/AnvarAhamed1234"),
    ("732225CCL02", "JEEVADHARSAN M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Jeevadharsan12/"),
    ("732225CCL03", "KATHIR V", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/Kathir260"),
    ("732225CCL04", "LINGESWARAN M", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/LINGESWARAN_6"),
    ("732225CCL05", "MOHAMMED HAROON M", "CSE(CS)", "II", "A", "", ""),
    ("732225CCL06", "SHYNTH ABRAHAM C", "CSE(CS)", "II", "A", "", "https://leetcode.com/u/ShynthAbraham/"),
]

# IV Year CSE(CS) Students (28 records)
IV_YEAR_CSE_CS = [
    ("23CC001", "AATHAVAN T", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/AathavanThiyakeswaran/"),
    ("23CC002", "S.ABIRAMI", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/ShtLj6CNJL/"),
    ("23CC003", "ASWIN P", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/aswinkanin/"),
    ("23CC005", "BHARATH I", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Bharath_77/"),
    ("23CC007", "DEEPADHARSHINI C", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/deepadharshini_10/"),
    ("23CC009", "DEEPAKKUMAR E", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Deepak1524/"),
    ("23CC010", "DEEPAKKUMAR M", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Deepak2612/"),
    ("23CC013", "ENIYAVAN R", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Eniyavan_r/"),
    ("23CC017", "JANARANSHINI P", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Janaranshini_17/"),
    ("23CC020", "KANISHAA.K.S", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/kani_shaa/"),
    ("23CC021", "KANISKA N J", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/ka_nizzu29/"),
    ("23CC023", "KAVINRAJAN K", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/kavinrajan/"),
    ("23CC025", "KEERTHANA B", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Keerthu-2005/"),
    ("23CC031", "MOWNAVARTHINI A L", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/mowna_14/"),
    ("23CC038", "PRAVEEN KUMAR J", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/PRAVEEN360/"),
    ("23CC039", "PRAVEEN VENKATESH A", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/pravexn/"),
    ("23CC042", "PRIYADHARSHINI K", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/dhars_02/"),
    ("23CC043", "RAGAVAN S", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/j123kcmcm/"),
    ("23CC044", "RAM PRAKASH S", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Ramprakash5/"),
    ("23CC045", "RATHEESH S", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/ratheesh1226/"),
    ("23CC046", "RITHIKA P", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/rithikap13/"),
    ("23CC047", "SARAVANAN R", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/SARAVANAN_ROLEX/"),
    ("23CC050", "SRIVIDHYA S", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/SRIVIDHYA_25/"),
    ("23CC051", "SRIRAM.S", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Sriram6758/"),
    ("23CC052", "STEFFY MARTINA P", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Steffy_15/"),
    ("23CC053", "SUBITHA P S", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/23cc053/"),
    ("23CC056", "VIGNESH J", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Vignesh_2639/"),
    ("23CC059", "WASIM M", "CSE(CS)", "IV", "A", "", "https://leetcode.com/u/Wasim_M/"),
]

# II Year CSE(IOT) Students (62 records)
II_YEAR_CSE_IOT = [
    ("732225CI001", "AARTHI R S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/aarthi-rs"),
    ("732225CI002", "BHARANITHARAN R", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/732225ci002-bharanitharan-r"),
    ("732225CI003", "BHUPESH S A", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/732225ci003-bhupesh-s-a"),
    ("732225CI004", "DEVI SHREE M", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/devishree2026/"),
    ("732225CI005", "DHANYA J", "CSE(IOT)", "II", "A", "", "https://leetcode.com/"),
    ("732225CI006", "DHARANI I", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Dharani_0404"),
    ("732225CI007", "DHARSHAN S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/DHARSHAN_X0/"),
    ("732225CI008", "DHARSHINI G", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Dharshini_Ramya/"),
    ("732225CI009", "GAYATHRI R", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Gayathri_VP/"),
    ("732225CI010", "GEERTHANA A S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/geerthanaas_2008"),
    ("732225CI011", "GOBIKRISHNA M", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Gobi_krishna/"),
    ("732225CI012", "GOKULKRISHNA M", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Gokulkrishna_26/"),
    ("732225CI013", "GOKUL P S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/gokulps/"),
    ("732225CI014", "HARIPRIYA S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/haripriya_14"),
    ("732225CI015", "HARSHINI R", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Harshini_CN/"),
    ("732225CI016", "INIYA A", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/ZDHinXS03z"),
    ("732225CI017", "JANANI D", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Janannn_iiiiii/"),
    ("732225CI018", "JAYASURIYA V", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Jayasuriya_27/"),
    ("732225CI019", "KARUPPUSAMYDEEPAK P", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Deepak_2d"),
    ("732225CI020", "KAVIYA JAYA CHITRA A", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/kaviya_Jaya_Chitra/"),
    ("732225CI021", "KIRAN CHANTH T L", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Kiranchanth_21/"),
    ("732225CI022", "KISHORE KANNA S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Kishore_Kanna_S/"),
    ("732225CI023", "MADHU BALA P", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Madhubala_45/"),
    ("732225CI024", "MALAVIKA G", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Malavika_24"),
    ("732225CI025", "MOHAMMED YUNUS A", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Md_yunus025/"),
    ("732225CI026", "MONISHA C", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Mw9qUJLaJo"),
    ("732225CI027", "NANTHEES N S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/NANTHEES_NS-14"),
    ("732225CI028", "NAVIN V", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Navin_IOT_28/"),
    ("732225CI029", "NIKILAN S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/NIRAI_NIKILAN"),
    ("732225CI030", "NISHA C", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/732225ci030-nisha-c"),
    ("732225CI031", "NITHISH KUMAR B", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Nithishkumar_A_2602/"),
    ("732225CI032", "NOUSHAL HASHIM A", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/qXuSu2Zg8M/"),
    ("732225CI033", "POOJANA R", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Pooja_AP/"),
    ("732225CI034", "PRAVEENA S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/praveena_selvaraj/"),
    ("732225CI035", "PRIYADHARSHINI K M", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Priyadharshini_0506"),
    ("732225CI036", "PUGAZHENTHI G", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/pugazhenthi123/"),
    ("732225CI037", "RAGUL T", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/ragul_bruce/"),
    ("732225CI038", "RAGULRAAJ M", "CSE(IOT)", "II", "A", "", "https://share.google/TZFiXOBGVsjzvlOZD"),
    ("732225CI039", "ROHITH P", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Rohith_pannirselvam/"),
    ("732225CI040", "ROSHAN AKTHAR K", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Roshan_v46/"),
    ("732225CI041", "SAHA N", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Saha_NC/"),
    ("732225CI042", "SALINI S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/salini-25"),
    ("732225CI043", "SANJAI B", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Sanjaaiiii_/"),
    ("732225CI044", "SANJAY KUMAR M", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/sk21_sanjay/"),
    ("732225CI045", "SANJEEV R T", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/GAgrm4ykwn/"),
    ("732225CI046", "SANTHOSH KUMAR S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Santhosh_Mahi/"),
    ("732225CI047", "SATHISH M", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Sathish_chml"),
    ("732225CI048", "SHARMATHA K", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Sharmatha_K"),
    ("732225CI049", "SHIVAN SUNDAR V", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/GAgrm4ykwn/"),
    ("732225CI050", "SHREEDHARSHAN S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Shreedharshan_s/"),
    ("732225CI051", "SMITHA M", "CSE(IOT)", "II", "A", "", ""),
    ("732225CI052", "SORNA RIYAS J", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/RIYAS18/"),
    ("732225CI053", "SUDHARSHAN E", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/SUDHARSHAN_E-01/"),
    ("732225CI054", "SURYAKUMAR J", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/suryalic"),
    ("732225CI055", "SWEDHAN S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/swedhan_s/"),
    ("732225CI056", "THAMARAIKANNAN M R", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Thamaraikannan_mr_2007"),
    ("732225CI057", "THIVYASRUTHI G D", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/ThivyaSruthi_20/"),
    ("732225CI058", "THIYA S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/thiya2026/"),
    ("732225CI059", "VANITHA E", "CSE(IOT)", "II", "A", "", ""),
    ("732225CI060", "VANITHA S", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Vanitha_07"),
    ("732225CI061", "YALENEY POOFSIN C", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/yaleneypoofsin"),
    ("732225CI062", "YAZHINI M P", "CSE(IOT)", "II", "A", "", "https://leetcode.com/u/Yazhini-0508/"),
]

def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        print("Seeding database with II, III & IV Year real student lists...")

        # 1. Academic Year
        ay = db.query(AcademicYear).filter(AcademicYear.name == "2026-27").first()
        if not ay:
            ay = AcademicYear(name="2026-27", is_current=True)
            db.add(ay)

        # 2. Departments
        cs_dept = db.query(Department).filter(
            (Department.code == "CSE(CS)") | (Department.name.ilike("%Cyber Security%")) | (Department.code == "CSE-CY")
        ).first()
        if not cs_dept:
            cs_dept = Department(
                name="Computer Science and Engineering (Cyber Security)",
                code="CSE(CS)"
            )
            db.add(cs_dept)
        else:
            cs_dept.name = "Computer Science and Engineering (Cyber Security)"
            cs_dept.code = "CSE(CS)"

        iot_dept = db.query(Department).filter(
            (Department.code == "CSE(IOT)") | (Department.code == "ECE-IOT") | (Department.name.ilike("%IoT%"))
        ).first()
        if not iot_dept:
            iot_dept = Department(
                name="Computer Science and Engineering (IoT)",
                code="CSE(IOT)"
            )
            db.add(iot_dept)
        else:
            iot_dept.name = "Computer Science and Engineering (IoT)"
            iot_dept.code = "CSE(IOT)"

        db.commit()
        db.refresh(cs_dept)
        db.refresh(iot_dept)

        # 3. Sections
        sec_cs_iv = db.query(Section).filter(
            Section.department_id == cs_dept.id, Section.year_level == "IV", Section.name == "A"
        ).first()
        if not sec_cs_iv:
            sec_cs_iv = Section(name="A", department_id=cs_dept.id, year_level="IV")
            db.add(sec_cs_iv)

        sec_cs_iii = db.query(Section).filter(
            Section.department_id == cs_dept.id, Section.year_level == "III", Section.name == "NEC"
        ).first()
        if not sec_cs_iii:
            sec_cs_iii = Section(name="NEC", department_id=cs_dept.id, year_level="III")
            db.add(sec_cs_iii)

        sec_cs_ii = db.query(Section).filter(
            Section.department_id == cs_dept.id, Section.year_level == "II", Section.name == "A"
        ).first()
        if not sec_cs_ii:
            sec_cs_ii = Section(name="A", department_id=cs_dept.id, year_level="II")
            db.add(sec_cs_ii)

        sec_iot_ii = db.query(Section).filter(
            Section.department_id == iot_dept.id, Section.year_level == "II", Section.name == "A"
        ).first()
        if not sec_iot_ii:
            sec_iot_ii = Section(name="A", department_id=iot_dept.id, year_level="II")
            db.add(sec_iot_ii)

        db.commit()
        db.refresh(sec_cs_iv)
        db.refresh(sec_cs_iii)
        db.refresh(sec_cs_ii)
        db.refresh(sec_iot_ii)

        # 4. Super Admin User
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@college.edu",
                hashed_password=get_password_hash("admin123"),
                role="Super Admin"
            )
            db.add(admin_user)
        else:
            admin_user.hashed_password = get_password_hash("admin123")
        db.commit()

        # Combine all 4 datasets (Total 221 real students)
        all_students = []
        for row in IV_YEAR_CSE_CS:
            all_students.append((*row, cs_dept.id, sec_cs_iv.id))
        for row in III_YEAR_CSE_CS:
            all_students.append((*row, cs_dept.id, sec_cs_iii.id))
        for row in II_YEAR_CSE_CS:
            all_students.append((*row, cs_dept.id, sec_cs_ii.id))
        for row in II_YEAR_CSE_IOT:
            all_students.append((*row, iot_dept.id, sec_iot_ii.id))

        # Purge any old test students
        real_reg_nos = {row[0] for row in all_students}
        deleted_old = db.query(Student).filter(~Student.reg_no.in_(real_reg_nos)).delete(synchronize_session=False)
        if deleted_old > 0:
            print(f"Purged {deleted_old} old dummy test student records.")
        db.commit()

        # 5. Load all 221 real students
        for reg, name, dept_code, yr, sec_name, email, url, d_id, s_id in all_students:
            username, url_status = extract_leetcode_username(url)

            stud = db.query(Student).filter(Student.reg_no == reg).first()
            if not stud:
                stud = Student(
                    reg_no=reg,
                    name=name,
                    department_id=d_id,
                    year_level=yr,
                    section_id=s_id,
                    email=email if email else None,
                    leetcode_url=url,
                    username=username,
                    is_active=True
                )
                db.add(stud)
                db.commit()
                db.refresh(stud)

                # Seed specific stats for #1 College Ranker NANTHISH S (732224CC031)
                if reg == "732224CC031":
                    stats.total_solved = 645
                    stats.easy_solved = 213
                    stats.medium_solved = 323
                    stats.hard_solved = 109
                    stats.contest_rating = 1845.5
                    stats.contest_global_ranking = 14200
                    stats.status = "OK"
            else:
                stud.name = name
                stud.department_id = d_id
                stud.year_level = yr
                stud.section_id = s_id
                stud.leetcode_url = url
                stud.username = username
                stud.is_active = True
                if email: stud.email = email

                if reg == "732224CC031" and stud.stats:
                    stud.stats.total_solved = 645
                    stud.stats.easy_solved = 213
                    stud.stats.medium_solved = 323
                    stud.stats.hard_solved = 109
                    stud.stats.contest_rating = 1845.5
                    stud.stats.contest_global_ranking = 14200
                    stud.stats.status = "OK"

            # Create or update WeeklyStudentProgress for NANTHISH S with 200-day active streak
            if reg == "732224CC031":
                prog = db.query(WeeklyStudentProgress).filter(WeeklyStudentProgress.student_id == stud.id).first()
                if not prog:
                    prog = WeeklyStudentProgress(
                        student_id=stud.id,
                        weekly_progress=12,
                        streak_count=200,
                        consistency_score=99.8,
                        college_rank=1,
                        dept_rank=1,
                        year_rank=1,
                        section_rank=1
                    )
                    db.add(prog)
                else:
                    prog.streak_count = 200
                    prog.weekly_progress = 12
                    prog.college_rank = 1
                    prog.dept_rank = 1

        db.commit()

        # 6. Seed Current Weekly Session
        today_str = datetime.date.today().isoformat()
        sess = db.query(WeeklySession).filter(WeeklySession.session_date == today_str).first()
        if not sess:
            sess = WeeklySession(
                academic_year="2026-27",
                week_number=datetime.date.today().isocalendar()[1],
                session_date=today_str,
                start_time="08:00",
                end_time="09:30",
                status="ACTIVE"
            )
            db.add(sess)
            db.commit()

        print(f"Successfully seeded database with {len(all_students)} real student records (II, III & IV Year)! ")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
