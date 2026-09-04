"""
apply_url_updates.py — Applies accurate new LeetCode URLs and usernames
for I Year and II Year CSE(CS) and CSE(IOT) students as per the official Excel roster screenshots.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database import SessionLocal
from backend.models import Student, LeetCodeProfileStats
from backend.scripts.import_fresh_students_dataset import generate_canonical_roster
from backend.cache import cache

URL_CORRECTIONS = {
    # --- I Year (Batch 2029) CSE(CS) ---
    "732225CC001": ("AARATHANA L", "LQatH0XhaQ"),
    "732225CC002": ("AARSIKA M", "Aarsika_M"),
    "732225CC003": ("ABHISHEK M", "abhishek_cc003"),
    "732225CC004": ("ABINAYA S", "Abi_CC004"),
    "732225CC005": ("ASHVIK AKHIL RAJAN R", "ASHVIKAKILRAJAN123"),
    "732225CC006": ("DEEPAK T", "0MGVas8msd"),
    "732225CC007": ("DEEPIKA G L", "deepika1013"),
    "732225CC008": ("DHARANEESH SABARI N", "8ErBz0vdVq"),
    "732225CC009": ("DHARSHAN G", "dharshang2007"),
    "732225CC010": ("DIVYANAND G R", None),
    "732225CC011": ("FARVAESIH MUSHRAF M", "6oryrbP7Cn"),
    "732225CC012": ("GAYATHIRIDEVI P", None),
    "732225CC013": ("GIBSON KENLEY S", "n1J49Ovita"),
    "732225CC014": ("GOKULRAJ R", "Gokulraj14"),
    "732225CC015": ("GOWRIPRIYA M", "81jUYqRRqL"),
    "732225CC016": ("HARISH B", "732225CC016"),
    "732225CC017": ("HARISH M S", "harishms2007"),
    "732225CC018": ("JANARTHANAN R", "jana777"),
    "732225CC019": ("JAYASRI R", "Jayasri3103"),
    "732225CC020": ("JAYEL CHRISTILA SCUDDER", "Jayel_18"),
    "732225CC021": ("JEBARSON K", "ZRHMO8kNyY"),
    "732225CC022": ("JEEVITHA S", "Jeevi_AlgoQueen"),
    "732225CC023": ("KARMUGIL V", "p4j1zKdZXp"),
    "732225CC024": ("KAVI PRIYA T", "rBjc1gqtsB"),
    "732225CC025": ("KAVIN B", "KAVIN019"),
    "732225CC026": ("KEERTHEESH K R", "subil"),
    "732225CC027": ("KEERTHI RAJA S", "KAVIN019"),
    "732225CC028": ("LALITHKUMAR B V", "LalithKumar19"),
    "732225CC029": ("LIGITH SANJAY G", "Elizx47N2Af"),
    "732225CC030": ("MIDESH K P", "midesh_123"),
    "732225CC031": ("MOUNESH G", "j01UT4oMOT"),
    "732225CC032": ("MUKESH S", "Mukeshmukesh123"),
    "732225CC033": ("NAVASAKTHI K K", "Nava_sakthi"),
    "732225CC034": ("NAVEEN R", "HR1lfJuaDf"),
    "732225CC035": ("NIVETHAA S B", "nivethaa_baskaran"),
    "732225CC036": ("POOVARASU A", "POOVARASU_A"),
    "732225CC037": ("PRADEEPA M", "PradeepaM_"),
    "732225CC038": ("PRIYADHARSHINI D", "Priyaa_27"),
    "732225CC039": ("PRIYADHARSHINI G", "f0Gm3IZrgv"),
    "732225CC040": ("PRIYADHARSHINI P", "mn6vcyWJAN"),
    "732225CC041": ("RAJABALAN B", "RAJABALAN_B"),
    "732225CC042": ("RAVIBHARATHI R", "RaviBharathi1234"),
    "732225CC043": ("ROKITHKISHOR R S", "ROKITHKISHOR"),
    "732225CC044": ("SABARI T", "sabari_044"),
    "732225CC045": ("SAHANAJ BANU M", "sahanajbanu"),
    "732225CC046": ("SAJAN VENKAT M", "SAJAN_VENKAT"),
    "732225CC047": ("SANTHOSH M", "ZAWxicjOUw"),
    "732225CC048": ("SARATHY S", "m2qGojuz57"),
    "732225CC049": ("SASINESAN T", "LeueJEWPmY"),
    "732225CC050": ("SHRUTI S", "rM0HpSQTH6"),
    "732225CC051": ("SIDDHDEV V R", "SIDDHDEV"),
    "732225CC052": ("STALIN A", "STALIN_A"),
    "732225CC053": ("SUBILNATH G", "WbcKc8koB8"),
    "732225CC054": ("SUJITH A", "Sujithnandha"),
    "732225CC055": ("SURUTHI S", "ZYI7QEg6OO"),
    "732225CC056": ("SUSITHA U", "SusithaU"),
    "732225CC057": ("SUVATHI V", "00uzqPrWkf"),
    "732225CC058": ("SWETHA JAYASIKA P", "aUkFZZq7AJ"),
    "732225CC059": ("TAMILARASAN S", "_Tamilarasan"),
    "732225CC060": ("THARANYA L", "tharanya008"),
    "732225CC061": ("VETRIVEL G", "2M4WMu7lCg"),
    "732225CC062": ("YOGESH P", "YOGESH_062"),

    # --- I Year (Batch 2029) CSE(IOT) ---
    "732225CI001": ("AARTHI R S", "aarthi-rs"),
    "732225CI002": ("BHARANITHARAN R", "732225ci002-bharanitharan-r"),
    "732225CI003": ("BHUPESH S A", "732225ci003-bhupesh-s-a"),
    "732225CI004": ("DEVI SHREE M", "devishree2026"),
    "732225CI005": ("DHANYA J", None),
    "732225CI006": ("DHARANI I", "Dharani_0404"),
    "732225CI007": ("DHARSHAN S", "DHARSHAN_X0"),
    "732225CI008": ("DHARSHINI G", "Dharshini_Ramya"),
    "732225CI009": ("GAYATHRI R", "Gayathri_VP"),
    "732225CI010": ("GEERTHANA A S", "geerthanaas_2008"),
    "732225CI011": ("GOBIKRISHNA M", "Gobi_krishna"),
    "732225CI012": ("GOKULKRISHNA M", "Gokulkrishna_26"),
    "732225CI013": ("GOKUL P S", "gokulps"),
    "732225CI014": ("HARIPRIYA S", "haripriya__14"),
    "732225CI015": ("HARSHINI R", "Harshini_CN"),
    "732225CI016": ("INIYA A", "ZDHinXS03z"),
    "732225CI017": ("JANANI D", "Janannn_iiiiii"),
    "732225CI018": ("JAYASURIYA V", "Jayasuriya_27"),
    "732225CI019": ("KARUPPUSAMYDEEPAK P", "Deepak_2d"),
    "732225CI020": ("KAVIYA JAYA CHITRA A", "kaviya_Jaya_Chitra"),
    "732225CI021": ("KIRAN CHANTH T L", "Kiranchanth_21"),
    "732225CI022": ("KISHORE KANNA S", "Kishore_Kanna_S"),
    "732225CI023": ("MADHU BALA P", "Madhubala_45"),
    "732225CI024": ("MALAVIKA G", "Malavika__24"),
    "732225CI025": ("MOHAMMED YUNUS A", "Md_yunus025"),
    "732225CI026": ("MONISHA C", "Mw9qUJLaJo"),
    "732225CI027": ("NANTHEES N S", "NANTHEES_NS-14"),
    "732225CI028": ("NAVIN V", "Navin_IOT_28"),
    "732225CI029": ("NIKILAN S", "NIRAL_NIKILAN"),
    "732225CI030": ("NISHA C", "732225ci030-nisha-c"),
    "732225CI031": ("NITHISH KUMAR B", "Nithishkumar_A_2602"),
    "732225CI032": ("NOUSHAL HASHIM A", "qUxSu2Zg8M"),
    "732225CI033": ("POOJANA R", "Pooja_AP"),
    "732225CI034": ("PRAVEENA S", "praveena_selvaraj"),
    "732225CI035": ("PRIYADHARSHINI K M", "Priyadharshini_0506"),
    "732225CI036": ("PUGAZHENTHI G", "pugazhenthi123"),
    "732225CI037": ("RAGUL T", "ragul_bruce"),
    "732225CI038": ("RAGULRAAJ M", "Rohith_pannirselvam"),
    "732225CI039": ("ROHITH P", "ROHITH_P"),
    "732225CI040": ("ROSHAN AKTHAR K", "Roshan_v46"),
    "732225CI041": ("SAHA N", "Saha_NC"),
    "732225CI042": ("SALINI S", "salini-25"),
    "732225CI043": ("SANJAI B", "Sanjaaaiiiii_"),
    "732225CI044": ("SANJAY KUMAR M", "sk21_sanjay"),
    "732225CI045": ("SANJEEV R T", "GAgrm4ykwn"),
    "732225CI046": ("SANTHOSH KUMAR S", "Santhosh_Mahi"),
    "732225CI047": ("SATHISH M", "Sathish_chml"),
    "732225CI048": ("SHARMATHA K", "Sharmatha_K"),
    "732225CI049": ("SHIVAN SUNDAR V", "GAgrm4ykwn"),
    "732225CI050": ("SHREEDHARSHAN S", "shreedharshan_s"),
    "732225CI051": ("SMITHA M", "SMITHA_M"),
    "732225CI052": ("SORNA RIYAS J", "RIYAS18"),
    "732225CI053": ("SUDHARSHAN E", "SUDHARSHAN_E-01"),
    "732225CI054": ("SURYAKUMAR J", "suryalic"),
    "732225CI055": ("SWEDHAN S", "swedhan_s"),
    "732225CI056": ("THAMARAIKANNAN M R", "thamaraikannan_mr_2007"),
    "732225CI057": ("THIVYASRUTHI G D", "ThivyaSruthi_20"),
    "732225CI058": ("THIYA S", "thiya2026"),
    "732225CI059": ("VANITHA E", "VANITHA_E"),
    "732225CI060": ("VANITHA S", "Vanitha_07"),
    "732225CI061": ("YALENEY POOFSIN C", "yaleneypoofsin"),
    "732225CI062": ("YAZHINI M P", "Yazhini-0508"),

    # --- II Year (Batch 2028) Specific Updates ---
    "732224CI050": ("SATHYANARAYANAN R", "Sathyanarayanan_11062006"),
    "732224CI038": ("PRAVEEN S", "praveen___234"),
    "732224CI034": ("NISHA S", "Nisha_Sivakumar"),
    "732224CI020": ("KIRUTHIKA K", "kiruthika__23"),
    "732224CI008": ("BHARATH K", "Spidy_42"),
    "732224CI007": ("ANU SRI S", "anu_07"),
    "732224CI004": ("ABISHEK C", "Abishek0007"),
    "732224CC048": ("SOWMIYA S", "Sowmiya_7383"),
    "732224CC047": ("SHARMILA P", "Sharmila__27"),
    "732224CC044": ("SAKTHI S", "sakthi0407"),
    "732224CC035": ("POOMITHA KS", "Poomitha_23"),
    "732224CC027": ("MANJUNATH D", "ByNXF6IdWN"),
    "732224CC029": ("MOHAMED THARIQ J", "Thariq2625"),
    "732224CC025": ("MAGUDAPATHI S", "Magudapathi26"),
    "732224CC021": ("KIRUTHIKAA P T", "KIRUTHIKAA_05"),
    "732224CC017": ("JANANI S", "Jananii_26"),
    "732224CC002": ("AMRUTHA M", "Amruthauma"),
}


def apply_updates():
    db = SessionLocal()
    print("Applying URL and username updates...")
    updated_count = 0

    for reg_no, (name, uname) in URL_CORRECTIONS.items():
        st = db.query(Student).filter(Student.reg_no == reg_no).first()
        if st:
            if uname:
                st.username = uname
                st.leetcode_url = f"https://leetcode.com/u/{uname}/"
            else:
                st.username = None
                st.leetcode_url = None
            if name and not st.name:
                st.name = name
            
            stats = db.query(LeetCodeProfileStats).filter(LeetCodeProfileStats.student_id == st.id).first()
            if stats:
                stats.sync_status = "not_started" if uname else "pending_username"
                stats.status = "pending" if uname else "MISSING LINK"
            updated_count += 1
            print(f"  [UPDATED] {reg_no} -> {name} -> {uname}")

    db.commit()
    cache.clear()
    print(f"Applied updates to {updated_count} students.")

    generate_canonical_roster(db)
    db.close()


if __name__ == "__main__":
    apply_updates()
