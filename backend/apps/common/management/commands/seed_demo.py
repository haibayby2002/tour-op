"""Seed reference data and a set of demo travelers and locals.

    python manage.py seed_demo                  # reference data + demo users (+ staff demo account when DEBUG)
    python manage.py seed_demo --reference-only
    python manage.py seed_demo --replace-images  # re-attach the seed/images pictures to the demo accounts

Idempotent: running it again only fills in what is missing, so it is safe to run on every deploy
(docker-entrypoint.sh does this when SEED_DEMO=1). Pictures come from seed/images (sliced from the
generated sheets in /seed_image) and go through the same re-encoding as user uploads.

Production (DEBUG off) differences, so a public demo password never guards anything important:
- the password comes from the DEMO_PASSWORD environment variable; there is no default;
- no staff account is created (use `createsuperuser`);
- existing reference data (cities, languages, interests imported from seed/*.csv) is never overwritten;
- no sample reports are filed.
"""
import os
from datetime import timedelta

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import User, UserRole, Verification
from apps.bookings.models import Agreement, Booking, ItineraryStop, TourRequest
from apps.common.images import process_avatar, process_photo
from apps.experiences.models import LocalService, ServiceCategory, ServicePhoto
from apps.messaging.services import open_conversation
from apps.profiles.models import (
    City,
    ExternalReviewSource,
    Interest,
    Language,
    LocalAvailability,
    LocalProfile,
    ProfilePhoto,
    TravelerProfile,
    UserInterest,
    UserLanguage,
)
from apps.profiles.services import ensure_profiles, refresh_completion
from apps.reviews.models import Review
from apps.safety.models import Report

LOCAL_DEMO_PASSWORD = "TourOps!2026"

# Picture codes used in LOCALS: "a17" = avatars/avatar_17.jpg, "b30" = backgrounds/background_30.jpg,
# "e41" = experiences/experience_41.jpg.
# Appended to every demo bio, so nobody mistakes these accounts for real people.
DEMO_NOTE = "(This is an example account for testing, and a sample for {role} to refer to when building their own profile.)"

SEED_IMAGES = settings.BASE_DIR / "seed" / "images"
IMAGE_DIRS = {"a": ("avatars", "avatar"), "b": ("backgrounds", "background"), "e": ("experiences", "experience")}

# Same slugs as seed/cities.csv, so a seeded database and one imported from the CSVs match.
CITIES = [
    ("ho-chi-minh-city", "Ho Chi Minh City", "TP. Hồ Chí Minh", 10.776900, 106.700900),
    ("hanoi", "Hanoi", "Hà Nội", 21.028500, 105.854200),
    ("danang", "Da Nang", "Đà Nẵng", 16.054400, 108.202200),
    ("hai-phong", "Hai Phong", "Hải Phòng", 20.844900, 106.688100),
]

LANGUAGES = [
    ("vi", "Vietnamese", "Tiếng Việt"), ("en", "English", "Tiếng Anh"), ("fr", "French", "Tiếng Pháp"),
    ("de", "German", "Tiếng Đức"), ("ja", "Japanese", "Tiếng Nhật"), ("ko", "Korean", "Tiếng Hàn"),
    ("zh", "Chinese", "Tiếng Trung"), ("es", "Spanish", "Tiếng Tây Ban Nha"), ("ru", "Russian", "Tiếng Nga"),
    ("th", "Thai", "Tiếng Thái"),
]

INTERESTS = [
    ("street-food", "Street food", "Ẩm thực đường phố", "food"),
    ("coffee", "Coffee culture", "Văn hoá cà phê", "food"),
    ("cooking", "Cooking", "Nấu ăn", "food"),
    ("history", "History", "Lịch sử", "culture"),
    ("architecture", "Architecture", "Kiến trúc", "culture"),
    ("art", "Art & galleries", "Nghệ thuật", "culture"),
    ("crafts", "Traditional crafts", "Làng nghề truyền thống", "culture"),
    ("spiritual", "Temples & pagodas", "Đền chùa", "culture"),
    ("music", "Live music", "Nhạc sống", "nightlife"),
    ("nightlife", "Nightlife", "Cuộc sống về đêm", "nightlife"),
    ("photography", "Photography", "Nhiếp ảnh", "activity"),
    ("nature", "Nature", "Thiên nhiên", "outdoors"),
    ("hiking", "Hiking", "Leo núi", "outdoors"),
    ("beaches", "Beaches", "Biển", "outdoors"),
    ("cycling", "Cycling", "Đạp xe", "outdoors"),
    ("motorbike", "Motorbike trips", "Đi xe máy", "outdoors"),
    ("markets", "Local markets", "Chợ địa phương", "local-life"),
    ("local-life", "Everyday local life", "Đời sống người dân", "local-life"),
]

CATEGORIES = [
    ("food", "Food & drink", "Ẩm thực"),
    ("culture", "Culture & history", "Văn hoá & lịch sử"),
    ("walking", "Walking tour", "Đi bộ khám phá"),
    ("photography", "Photography walk", "Dạo chụp ảnh"),
    ("nature", "Nature & outdoors", "Thiên nhiên"),
    ("nightlife", "Nightlife", "Về đêm"),
    ("workshop", "Workshop & crafts", "Workshop & làng nghề"),
    ("motorbike", "Motorbike tour", "Tour xe máy"),
]

# "review": the manual-check state staff see in the console (PENDING locals wait in its queue).
LOCALS = [
    {
        "email": "linh@tour-op.local", "phone": "+84901000001", "name": "Nguyễn Thuỳ Linh", "display": "Linh",
        "birth_year": 1995, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "FLUENT")],
        "interests": ["street-food", "coffee", "markets", "local-life"],
        "bio": "Born and raised in Saigon. I know every hidden alley food stall in District 3 and 4 and love showing travelers how locals really eat.",
        "experience": "Five years hosting friends of friends on food walks; I always agree the menu and prices before we go so there are no surprises.",
        "areas": "District 1, District 3, District 4, Chinatown (District 5)",
        "skills": "Ordering for allergies and dietary needs, explaining dishes, haggling-free market visits",
        "price": (450000, 900000), "years": 5, "review": "MANUALLY_CHECKED",
        "avatar": "a17", "background": "b30",
        "services": [
            ("food", "Saigon street food evening", "Six stops across District 3 and 4: broken rice, snails, bánh xèo and sugarcane juice. Vegetarian options available.", 210, 650000,
             "Guide fee, all food tastings at the six stops", "Drinks beyond one per stop, Grab rides between districts", ["e41", "e21", "e01", "e31"]),
            ("walking", "Morning market and coffee walk", "Wake up with the city: a wet market, a hidden apartment-block café and a bánh mì breakfast.", 150, 450000,
             "Guide fee, coffee and breakfast", "Shopping at the market", ["e03", "e23", "e02"]),
        ],
    },
    {
        "email": "minh@tour-op.local", "phone": "+84901000002", "name": "Trần Quang Minh", "display": "Minh",
        "birth_year": 1990, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "FLUENT"), ("fr", "CONVERSATIONAL")],
        "interests": ["photography", "architecture", "history", "local-life"],
        "bio": "Freelance photographer documenting Saigon's old apartment blocks and colonial architecture. Happy to help you get great shots.",
        "experience": "I have run photo walks for small groups for eight years and know the best light and the most photogenic corners.",
        "areas": "District 1, District 3, Thu Thiem, Binh Thanh",
        "skills": "Camera settings coaching, composition tips, respectful street photography",
        "price": (600000, 1200000), "years": 8, "review": "MANUALLY_CHECKED",
        "avatar": "a22", "background": "b16",
        "services": [
            ("photography", "Golden hour photo walk", "Old apartment blocks, colonial facades and the river at sunset, with tips for phone or camera.", 180, 800000,
             "Guide fee, photo coaching, edited selection of 10 photos", "Transport, drinks", ["e08", "e28", "e19", "e59"]),
        ],
    },
    {
        "email": "huong@tour-op.local", "phone": "+84901000003", "name": "Lê Thu Hương", "display": "Hương",
        "birth_year": 1988, "city": "hanoi", "langs": [("vi", "NATIVE"), ("en", "FLUENT"), ("ja", "CONVERSATIONAL")],
        "interests": ["history", "spiritual", "architecture", "coffee", "crafts"],
        "bio": "History teacher who loves the Old Quarter. I tell the stories behind the 36 streets, temples and guild houses.",
        "experience": "Ten years teaching history and four years guiding small groups through the Old Quarter and around Hoan Kiem Lake.",
        "areas": "Old Quarter, Hoan Kiem, Ba Dinh, West Lake",
        "skills": "Historical storytelling, temple etiquette, Japanese-speaking visitors",
        "price": (500000, 1000000), "years": 4, "review": "NOT_SUBMITTED",
        "avatar": "a40", "background": "b10",
        "services": [
            ("culture", "Old Quarter stories walk", "The history of Hanoi's guild streets, a hidden temple and egg coffee at a family café.", 180, 600000,
             "Guide fee, egg coffee", "Temple donations, souvenirs", ["b03", "b23", "e35", "e37"]),
            ("food", "Hanoi breakfast like a local", "Phở, bún chả and xôi at the stalls my family has eaten at for decades.", 120, 500000,
             "Guide fee, three breakfast dishes", "Extra dishes", ["e16", "e11", "e51"]),
        ],
    },
    {
        "email": "tuan@tour-op.local", "phone": "+84901000004", "name": "Phạm Anh Tuấn", "display": "Tuấn",
        "birth_year": 1993, "city": "danang", "langs": [("vi", "NATIVE"), ("en", "CONVERSATIONAL"), ("ko", "BASIC")],
        "interests": ["nature", "hiking", "beaches", "motorbike"],
        "bio": "Outdoor guy from Da Nang. Son Tra peninsula, Hai Van pass and quiet beaches are my playground.",
        "experience": "I have guided hikes and motorbike trips around Da Nang for six years with a clean safety record and first-aid training.",
        "areas": "Son Tra peninsula, Hai Van pass, My Khe beach, Ngu Hanh Son",
        "skills": "First aid certified, safe motorbike riding, weather planning",
        "price": (700000, 1500000), "years": 6, "review": "MANUALLY_CHECKED",
        "avatar": "a33", "background": "b25",
        "services": [
            ("nature", "Son Tra sunrise hike", "An easy-moderate hike to see the sunrise and, with luck, the red-shanked douc langurs.", 240, 900000,
             "Guide fee, water and snacks, first aid kit", "Transport to the trailhead", ["b13", "b19"]),
        ],
    },
    {
        "email": "mai@tour-op.local", "phone": "+84901000005", "name": "Võ Thị Mai", "display": "Mai",
        "birth_year": 1997, "city": "danang", "langs": [("vi", "NATIVE"), ("en", "FLUENT")],
        "interests": ["crafts", "cooking", "cycling", "local-life"],
        "bio": "Grew up between Da Nang and Hoi An. I love cycling through rice fields to visit craft villages and cook with families.",
        "experience": "Three years leading cycling and craft village tours. No shopping stops unless you ask for them.",
        "areas": "Hoi An Ancient Town, Tra Que, Thanh Ha pottery village, Cam Thanh",
        "skills": "Cycling routes for beginners, cooking classes, pottery",
        "price": (400000, 800000), "years": 3, "review": "NOT_SUBMITTED",
        "avatar": "a21", "background": "b22",
        "services": [
            ("workshop", "Craft villages by bicycle", "Cycle to Thanh Ha pottery village and Tra Que herb village; try pottery with a local family.", 240, 550000,
             "Guide fee, bicycle, pottery session", "Lunch, items you choose to buy", ["b02", "b12", "e10", "e30"]),
        ],
    },
    {
        "email": "an@tour-op.local", "phone": "+84901000006", "name": "Đỗ Bình An", "display": "An",
        "birth_year": 1991, "city": "hanoi", "langs": [("vi", "NATIVE"), ("en", "FLUENT"), ("de", "BASIC")],
        "interests": ["motorbike", "nature", "local-life", "cycling"],
        "bio": "Hanoi born, countryside at heart. Weekends I ride out to the villages and rice fields around the city.",
        "experience": "Seven years riding and five guiding small motorbike groups out of Hanoi. Helmets and rain gear always included.",
        "areas": "Long Bien, Red River delta, Duong Lam, Ba Vi",
        "skills": "Safe motorbike riding, riding with beginners on the back, rainy-season planning",
        "price": (800000, 1600000), "years": 5, "review": "MANUALLY_CHECKED",
        "services": [
            ("motorbike", "Red River countryside loop", "Cross Long Bien bridge, ride the river dykes, visit a banana island farm and Duong Lam's laterite houses.", 300, 1100000,
             "Guide and rider, helmets, rain ponchos, water", "Lunch, entrance tickets", []),
        ],
    },
    {
        "email": "khoa@tour-op.local", "phone": "+84901000007", "name": "Nguyễn Đăng Khoa", "display": "Khoa",
        "birth_year": 1996, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "FLUENT")],
        "interests": ["music", "nightlife", "street-food", "art"],
        "bio": "Bass player in a Saigon jazz trio. I know the small venues, rooftop bars and late-night snack spots locals actually go to.",
        "experience": "Two years showing visiting musicians and friends around Saigon at night. I keep groups small and get everyone home safely.",
        "areas": "District 1, District 3, Phu Nhuan",
        "skills": "Live music scene, late-night food, safe rides home",
        "price": (500000, 1000000), "years": 2, "review": "NOT_SUBMITTED",
        "avatar": "a35", "background": "b06",
        "services": [
            ("nightlife", "Saigon after dark: live music & late bites", "A jazz club, a hidden rooftop and a late-night bowl of hủ tiếu, all within walking distance.", 240, 700000,
             "Guide fee, one drink, late-night snack", "Further drinks, cover charges", ["e12", "e32", "e52"]),
        ],
    },
    {
        "email": "trang@tour-op.local", "phone": "+84901000008", "name": "Bùi Huyền Trang", "display": "Trang",
        "birth_year": 1994, "city": "hai-phong", "langs": [("vi", "NATIVE"), ("en", "CONVERSATIONAL")],
        "interests": ["street-food", "markets", "coffee", "local-life"],
        "bio": "Hai Phong is Vietnam's most underrated food city and I'll prove it, one bowl of bánh đa cua at a time.",
        "experience": "I run a small café and take guests from it on food walks through the old French quarter.",
        "areas": "Le Chan, Ngo Quyen, Hong Bang",
        "skills": "Food storytelling, market etiquette, ordering for vegetarians",
        "price": (350000, 700000), "years": 2, "review": "PENDING",
        "avatar": "a38", "background": "b21",
        "services": [
            ("food", "Hai Phong crab noodle morning", "Bánh đa cua, bánh mì cay and a market visit, ending with coffee in a French-era villa.", 150, 400000,
             "Guide fee, three tastings, coffee", "Extra dishes and shopping", ["e43", "e22"]),
        ],
    },
    {
        "email": "phuc@tour-op.local", "phone": "+84901000009", "name": "Hoàng Gia Phúc", "display": "Phúc",
        "birth_year": 1987, "city": "danang", "langs": [("vi", "NATIVE"), ("en", "FLUENT"), ("zh", "CONVERSATIONAL")],
        "interests": ["history", "spiritual", "architecture", "photography"],
        "bio": "Former museum guide at the Cham Museum. I love the stories carved into Da Nang's mountains and pagodas.",
        "experience": "Nine years as a museum guide, now hosting small cultural walks on my own schedule.",
        "areas": "Ngu Hanh Son (Marble Mountains), Hai Chau, Son Tra",
        "skills": "Cham history, pagoda etiquette, Mandarin-speaking guests",
        "price": (500000, 1000000), "years": 9, "review": "MANUALLY_CHECKED",
        "services": [
            ("culture", "Marble Mountains caves & pagodas", "Climb into the caves and pagodas of the Marble Mountains with the legends behind them.", 180, 650000,
             "Guide fee, water", "Entrance tickets, elevator", []),
        ],
    },
    {
        "email": "ngoc@tour-op.local", "phone": "+84901000010", "name": "Phan Bảo Ngọc", "display": "Ngọc",
        "birth_year": 1999, "city": "hanoi", "langs": [("vi", "NATIVE"), ("en", "FLUENT"), ("fr", "BASIC")],
        "interests": ["art", "crafts", "coffee", "architecture"],
        "bio": "Art student and café hopper. I'll show you Hanoi's galleries, propaganda-poster shops and the pottery village of Bát Tràng.",
        "experience": "One year hosting exchange students around Hanoi's art scene.",
        "areas": "Hoan Kiem, Truc Bach, Bat Trang",
        "skills": "Art history, pottery basics, café recommendations",
        "price": (400000, 800000), "years": 1, "review": "PENDING",
        "services": [
            ("workshop", "Bát Tràng pottery afternoon", "Bus to Bát Tràng, throw your own bowl on the wheel and visit a family kiln.", 240, 550000,
             "Guide fee, clay and wheel session, bus tickets", "Firing and shipping your bowl", []),
        ],
    },
    {
        "email": "thao@tour-op.local", "phone": "+84901000011", "name": "Lý Phương Thảo", "display": "Thảo",
        "birth_year": 1992, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "FLUENT")],
        "interests": ["cooking", "markets", "street-food", "local-life"],
        "bio": "My family comes from the Mekong Delta and I cook the way my grandmother taught me. My kitchen in District 3 is small, warm and always smells of lemongrass.",
        "experience": "Four years teaching home cooking classes to travelers and expats, always starting with a market visit.",
        "areas": "District 3, Tan Dinh market, Phu Nhuan",
        "skills": "Vegetarian and allergy-friendly menus, knife skills for beginners, market shopping",
        "price": (500000, 900000), "years": 4, "review": "MANUALLY_CHECKED",
        "avatar": "a34", "background": "b07",
        "services": [
            ("workshop", "Saigon home cooking class", "Shop for herbs at Tan Dinh market, then cook fresh spring rolls, a noodle salad and a clay-pot dish in my home kitchen.", 240, 750000,
             "Market ingredients, cooking class, lunch, recipe cards", "Transport to the market", ["e06", "e26", "e46", "e40", "e60", "e20"]),
        ],
    },
    {
        "email": "long@tour-op.local", "phone": "+84901000012", "name": "Trịnh Hoàng Long", "display": "Long",
        "birth_year": 1998, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "CONVERSATIONAL")],
        "interests": ["cycling", "nature", "photography", "local-life"],
        "bio": "Engineering student and weekend cyclist. The Saigon riverbank at sunset is my favourite place in the city.",
        "experience": "Two years leading small bike rides for a university cycling club.",
        "areas": "Thu Thiem, Binh Thanh, Tao Dan park",
        "skills": "Easy routes for beginners, bike fitting, traffic-safe riding",
        "price": (300000, 600000), "years": 2, "review": "NOT_SUBMITTED",
        "avatar": "a18", "background": "b27",
        "services": [
            ("nature", "Saigon riverside sunset ride", "An easy, flat ride along the Thu Thiem riverbank and through shady parks as the skyline lights up.", 150, 400000,
             "Guide fee, bicycle and helmet, water", "Drinks and snacks", ["e09", "e29", "e49", "e13"]),
        ],
    },
    {
        "email": "phuong@tour-op.local", "phone": "+84901000013", "name": "Đặng Minh Phương", "display": "Phương",
        "birth_year": 1996, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "FLUENT"), ("ko", "CONVERSATIONAL")],
        "interests": ["markets", "crafts", "art", "nightlife"],
        "bio": "Textile designer who buys fabric in the same markets I'll take you to. I know which stalls are handmade and which are not.",
        "experience": "Three years taking friends and Korean-speaking visitors around Saigon's markets and craft shops.",
        "areas": "Ben Thanh, District 1, District 5",
        "skills": "Spotting handmade crafts, fair prices without haggling battles, Korean-speaking guests",
        "price": (350000, 700000), "years": 3, "review": "MANUALLY_CHECKED",
        "avatar": "a42", "background": "b09",
        "services": [
            ("walking", "Night market & handmade crafts walk", "Lanterns, street snacks and the craft stalls worth your money, with a visit to a hat-painting workshop.", 180, 450000,
             "Guide fee, one street snack", "Anything you choose to buy", ["e07", "e27", "e47", "e14", "e34", "e54", "e50"]),
        ],
    },
    {
        "email": "duy@tour-op.local", "phone": "+84901000014", "name": "Ngô Đức Duy", "display": "Duy",
        "birth_year": 1989, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "FLUENT"), ("fr", "FLUENT")],
        "interests": ["history", "architecture", "photography", "art"],
        "bio": "Architect restoring old Saigon villas by day. I love explaining what the colonial buildings were and what they are now.",
        "experience": "Six years leading heritage walks for architecture students and French-speaking visitors.",
        "areas": "District 1, District 3",
        "skills": "Architecture history, French-speaking guests, accessible walking routes",
        "price": (550000, 1000000), "years": 6, "review": "MANUALLY_CHECKED",
        "avatar": "a37", "background": "b26",
        "services": [
            ("culture", "Colonial Saigon heritage walk", "City Hall, the cathedral, the post office and hidden villa facades, with the stories of who built them and why.", 180, 600000,
             "Guide fee, iced tea stop", "Entrance tickets", ["e04", "e24", "e44", "e15", "e55", "e39"]),
        ],
    },
    {
        "email": "hanh@tour-op.local", "phone": "+84901000015", "name": "Vũ Mỹ Hạnh", "display": "Hạnh",
        "birth_year": 1994, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "FLUENT")],
        "interests": ["coffee", "local-life", "art", "architecture"],
        "bio": "Former barista, now a coffee roaster. I'll show you phin coffee, coconut coffee and the garden cafés hidden in old apartment blocks.",
        "experience": "Five years in Saigon's coffee scene and two years hosting coffee walks.",
        "areas": "District 1, District 3, Binh Thanh",
        "skills": "Coffee tasting, decaf and dairy-free options, café recommendations",
        "price": (300000, 600000), "years": 5, "review": "MANUALLY_CHECKED",
        "avatar": "a19", "background": "b14",
        "services": [
            ("food", "Saigon coffee crawl", "Four cafés, four ways to drink coffee: phin, egg, coconut and salt coffee, in garden courtyards and old apartment blocks.", 180, 450000,
             "Guide fee, four coffees", "Food and extra drinks", ["e17", "e42", "e57", "e05", "e25", "e45"]),
        ],
    },
    {
        "email": "viet@tour-op.local", "phone": "+84901000016", "name": "Cao Quốc Việt", "display": "Việt",
        "birth_year": 1991, "city": "hanoi", "langs": [("vi", "NATIVE"), ("en", "FLUENT")],
        "interests": ["photography", "nature", "history", "local-life"],
        "bio": "Hanoi photographer who shoots the city's lakes at dawn, when the old men play badminton and the women dance.",
        "experience": "Five years running photo walks around Hanoi's lakes and old streets.",
        "areas": "Hoan Kiem, West Lake, Truc Bach",
        "skills": "Phone and camera photography, early-morning routes, respectful street portraits",
        "price": (500000, 900000), "years": 5, "review": "MANUALLY_CHECKED",
        "avatar": "a43", "background": "b28",
        "services": [
            ("photography", "Hanoi lakes at dawn photo walk", "Catch morning tai chi by Hoan Kiem, quiet lakeside paths and the Old Quarter waking up.", 150, 550000,
             "Guide fee, photo tips, coffee", "Transport", ["e48", "e33", "e53"]),
        ],
    },
    {
        "email": "son@tour-op.local", "phone": "+84901000017", "name": "Huỳnh Thanh Sơn", "display": "Sơn",
        "birth_year": 1986, "city": "danang", "langs": [("vi", "NATIVE"), ("en", "FLUENT")],
        "interests": ["motorbike", "beaches", "nature", "history"],
        "bio": "Born in Hue, living in Da Nang. I have ridden the Hai Van pass more times than I can count and still stop for every view.",
        "experience": "Ten years riding and seven years guiding motorbike day trips between Da Nang and Hue.",
        "areas": "Hai Van pass, Lang Co, My Khe beach",
        "skills": "Safe motorbike riding, riding with beginners on the back, Hue history",
        "price": (900000, 1700000), "years": 7, "review": "MANUALLY_CHECKED",
        "avatar": "a27", "background": "b18",
        "services": [
            ("motorbike", "Hai Van pass coastal ride", "Ride the Hai Van pass from Da Nang to Lang Co beach, past the railway line along the sea, with stops for every view.", 300, 1200000,
             "Guide and rider, helmets, rain ponchos, water", "Lunch, entrance tickets", ["b20", "b04", "b15"]),
        ],
    },
    {
        "email": "yen@tour-op.local", "phone": "+84901000018", "name": "Tạ Hải Yến", "display": "Yến",
        "birth_year": 1997, "city": "hai-phong", "langs": [("vi", "NATIVE"), ("en", "CONVERSATIONAL")],
        "interests": ["markets", "street-food", "local-life"],
        "bio": "Hai Phong girl who grew up above a fruit stall. I'll take you to the market at its busiest and feed you fruit you've never seen.",
        "experience": "One year hosting travelers who stop in Hai Phong on the way to Cat Ba.",
        "areas": "Le Chan, Sat market, Tam Bac lake",
        "skills": "Market etiquette, fruit tasting, ordering for vegetarians",
        "price": (250000, 500000), "years": 1, "review": "PENDING",
        "background": "b11",
        "services": [
            ("food", "Hai Phong fruit market morning", "Taste dragon fruit, rambutan and mangosteen at Sat market, then have bánh mì cay by Tam Bac lake.", 120, 300000,
             "Guide fee, fruit tasting, bánh mì cay", "Fruit you take home", ["e18", "e38", "e58"]),
        ],
    },
    {
        "email": "khang@tour-op.local", "phone": "+84901000019", "name": "Lâm Vĩnh Khang", "display": "Khang",
        "birth_year": 1995, "city": "ho-chi-minh-city", "langs": [("vi", "NATIVE"), ("en", "CONVERSATIONAL"), ("zh", "FLUENT")],
        "interests": ["street-food", "nightlife", "local-life"],
        "bio": "Chef at a District 5 grill restaurant. After my shift I go where the cooks eat, and I'll take you there too.",
        "experience": "Two years taking friends and Mandarin-speaking visitors on late-night food runs.",
        "areas": "District 5 (Chinatown), District 4, District 10",
        "skills": "Grilled food, Mandarin-speaking guests, ordering for allergies",
        "price": (400000, 800000), "years": 2, "review": "NOT_SUBMITTED",
        "background": "b29",
        "services": [
            ("food", "Saigon BBQ night food crawl", "Charcoal-grilled skewers, bánh xèo and a sweet soup in Chinatown and District 4, where the chefs eat after work.", 180, 550000,
             "Guide fee, food at four stops", "Beer and extra dishes", ["e36", "e56"]),
        ],
    },
    {
        "email": "ha@tour-op.local", "phone": "+84901000020", "name": "Đinh Thu Hà", "display": "Hà",
        "birth_year": 1993, "city": "hanoi", "langs": [("vi", "NATIVE"), ("en", "FLUENT"), ("es", "BASIC")],
        "interests": ["cooking", "street-food", "spiritual", "local-life"],
        "bio": "Vegetarian since my teens, following my mother's Buddhist kitchen. Hanoi has more meat-free food than people think.",
        "experience": "Three years showing vegetarian and vegan travelers around Hanoi.",
        "areas": "Hoan Kiem, Ba Dinh, Dong Da",
        "skills": "Vegetarian and vegan food, pagoda etiquette, basic Spanish",
        "price": (350000, 700000), "years": 3, "review": "NOT_SUBMITTED",
        "avatar": "a26",
        "services": [
            ("food", "Hanoi vegetarian lunch walk", "Tofu, bún and fresh rolls at a pagoda kitchen and two family-run vegetarian stalls.", 150, 450000,
             "Guide fee, lunch at three stops", "Drinks", []),
        ],
    },
]

TRAVELERS = [
    {
        "email": "traveler@tour-op.local", "phone": "+61400000001", "name": "Alex Morgan", "display": "Alex", "birth_year": 1994,
        "langs": [("en", "NATIVE")], "interests": ["street-food", "coffee", "history", "markets"], "style": "FOODIE",
        "bio": "Solo traveler from Melbourne on my first trip to Vietnam. I love food markets, coffee and slow walks.",
        "wishes": "Eat where locals eat and learn a bit of history.", "avoid": "No shopping stops, no bars.",
    },
    {
        "email": "sophie@tour-op.local", "phone": "+33600000002", "name": "Sophie Laurent", "display": "Sophie", "birth_year": 1989,
        "langs": [("fr", "NATIVE"), ("en", "FLUENT")], "interests": ["history", "architecture", "art"], "style": "CULTURAL",
        "bio": "Architect from Lyon, curious about French-era buildings and how people live in them today.",
        "wishes": "Old buildings, the stories behind them and a good café.", "avoid": "Big tour groups.",
    },
    {
        "email": "kenji@tour-op.local", "phone": "+81900000003", "name": "Kenji Sato", "display": "Kenji", "birth_year": 1992,
        "langs": [("ja", "NATIVE"), ("en", "CONVERSATIONAL")], "interests": ["photography", "nature", "hiking"], "style": "ADVENTUROUS",
        "bio": "Weekend photographer from Osaka. Sunrise hikes and street photography are my favourite things.",
        "wishes": "Golden-hour spots and an early hike.", "avoid": "Crowded tourist sites at midday.",
    },
    {
        "email": "minji@tour-op.local", "phone": "+82100000004", "name": "Kim Min-ji", "display": "Min-ji", "birth_year": 1998,
        "langs": [("ko", "NATIVE"), ("en", "FLUENT")], "interests": ["street-food", "coffee", "music", "nightlife"], "style": "FOODIE",
        "bio": "Seoul office worker on a long-awaited holiday with a friend. We want to eat everything.",
        "wishes": "Street food, cafés and some live music at night.", "avoid": "Very spicy food.",
    },
    {
        "email": "lukas@tour-op.local", "phone": "+49150000005", "name": "Lukas Becker", "display": "Lukas", "birth_year": 1990,
        "langs": [("de", "NATIVE"), ("en", "FLUENT")], "interests": ["motorbike", "hiking", "nature"], "style": "ADVENTUROUS",
        "bio": "Backpacking from Hanoi to Saigon over six weeks, mostly on two wheels.",
        "wishes": "Countryside rides and someone who knows the back roads.", "avoid": "Shopping stops.",
    },
    {
        "email": "maria@tour-op.local", "phone": "+34600000006", "name": "María García", "display": "María", "birth_year": 1996,
        "langs": [("es", "NATIVE"), ("en", "CONVERSATIONAL")], "interests": ["crafts", "cooking", "beaches", "local-life"], "style": "BUDGET",
        "bio": "Teacher from Valencia travelling on a budget. I love learning crafts and cooking from families.",
        "wishes": "Hands-on activities and time with local families.", "avoid": "Expensive restaurants.",
    },
]

# (traveler email, local email, rating, traveler's review of the local, local's review of the traveler)
HISTORY = [
    ("traveler", "linh", 5, "Linh was wonderful: every price was agreed upfront and the food was amazing.", "Friendly, on time and curious. Welcome back anytime!"),
    ("traveler", "huong", 4, "Hương knows so much history. Lovely morning.", "Great questions and very respectful in the temples."),
    ("sophie", "huong", 5, "The guild-street stories were exactly what I hoped for. Merci!", "Sophie knew more about the architecture than I do. A joy."),
    ("sophie", "minh", 5, "Minh found angles of the old apartment blocks I'd never have seen.", "Patient and fun to shoot with."),
    ("kenji", "minh", 5, "Best golden-hour walk of my trip. Great camera tips.", "Kenji was punctual and kind. Welcome back!"),
    ("kenji", "tuan", 5, "We saw the langurs at sunrise! Tuấn was careful on every trail.", "Fit, prepared and great company."),
    ("minji", "linh", 5, "We ate so much and Linh checked every dish for spice for us.", "Two happy eaters, lovely guests."),
    ("minji", "khoa", 4, "The jazz club was fantastic. Ran a little late but worth it.", "Fun group, thanks for a great night."),
    ("lukas", "tuan", 5, "Hai Van pass with a local who knows every curve. Felt safe the whole way.", "Experienced rider, easy to guide."),
    ("lukas", "an", 5, "The river dyke ride was the highlight of Hanoi. Helmets and ponchos ready.", "Lukas was a great passenger and very curious."),
    ("maria", "mai", 5, "I made my own pottery bowl! Mai was so patient with my cycling.", "María was warm and eager to learn."),
    ("maria", "phuc", 5, "Phúc's stories made the Marble Mountains come alive.", "Lovely guest, on time and respectful."),
    ("maria", "thao", 5, "Thảo's kitchen felt like family. I can finally roll spring rolls!", "María chopped faster than me by the end. Come back soon!"),
    ("traveler", "hanh", 5, "Four coffees, four hidden cafés. Hạnh knows everyone in them.", "Alex loved the salt coffee most. Great company."),
    ("sophie", "duy", 5, "Duy showed me details on the villas I'd never have noticed. Merci!", "Sophie asked the best architecture questions."),
    ("kenji", "viet", 4, "Beautiful light at Hoan Kiem. A very early start, but worth it.", "Kenji was there before me at 5am!"),
    ("lukas", "son", 5, "The Hai Van pass with Sơn was the best day of my trip. Safe and relaxed.", "Strong rider and great fun."),
    ("minji", "phuong", 5, "Phương helped us find real handmade bags and spoke Korean with us!", "Two lovely guests, thank you."),
]


class Command(BaseCommand):
    help = "Seed reference data and demo travelers and locals (idempotent)"

    def add_arguments(self, parser):
        parser.add_argument("--reference-only", action="store_true")
        parser.add_argument("--replace-images", action="store_true",
                            help="Replace the demo locals' avatars and photos with the seed pictures, even if they have others")

    @transaction.atomic
    def handle(self, *args, **options):
        self.password = os.environ.get("DEMO_PASSWORD") or (LOCAL_DEMO_PASSWORD if settings.DEBUG else None)
        self.replace_images = options["replace_images"]
        self._reference()
        if options["reference_only"]:
            self.stdout.write(self.style.SUCCESS("Reference data seeded."))
            return
        if not self.password:
            raise CommandError("Set DEMO_PASSWORD: production demo users must not share the public development password.")

        if settings.DEBUG:
            admin = self._user("admin@tour-op.local", "+84900000000", "Tour-op Admin", 1985, [UserRole.Role.TRAVELER])
            admin.is_staff = admin.is_superuser = True
            admin.save()
        travelers = {spec["email"].split("@")[0]: self._traveler(spec) for spec in TRAVELERS}
        locals_ = {spec["email"].split("@")[0]: self._local(spec) for spec in LOCALS}
        for traveler, local, rating, comment, reply in HISTORY:
            self._history(travelers[traveler], locals_[local], rating, comment, reply)
        if settings.DEBUG:
            self._moderation_samples(travelers, locals_)
        for user in [*travelers.values(), *locals_.values()]:
            refresh_completion(user)

        shown = self.password if self.password == LOCAL_DEMO_PASSWORD else "(value of DEMO_PASSWORD)"
        self.stdout.write(self.style.SUCCESS(
            f"Demo data ready. Password for all demo users: {shown}\n"
            + ("  admin@tour-op.local (staff: /staff console and /admin)\n" if settings.DEBUG else "")
            + "\n".join(f"  {s['email']} (traveler)" for s in TRAVELERS) + "\n"
            + "\n".join(f"  {s['email']} (local, {s['city']})" for s in LOCALS)
        ))

    def _reference(self):
        # Earlier versions of this command used "da-nang"; seed/cities.csv (and production) use "danang".
        # If both exist (a CSV import ran after an old seed), retire the old one; never delete a city.
        if not City.objects.filter(slug="danang").exists():
            City.objects.filter(slug="da-nang").update(slug="danang")
        else:
            City.objects.filter(slug="da-nang").update(is_active=False)
        # get_or_create: never overwrite names an admin or import_reference has set.
        for slug, name, name_vi, lat, lng in CITIES:
            City.objects.get_or_create(slug=slug, defaults={"name": name, "name_vi": name_vi, "latitude": lat, "longitude": lng})
        for code, name, name_vi in LANGUAGES:
            Language.objects.get_or_create(code=code, defaults={"name": name, "name_vi": name_vi})
        for slug, name, name_vi, category in INTERESTS:
            Interest.objects.get_or_create(slug=slug, defaults={"name": name, "name_vi": name_vi, "category": category})
        for slug, name, name_vi in CATEGORIES:
            ServiceCategory.objects.get_or_create(slug=slug, defaults={"name": name, "name_vi": name_vi})

    def _user(self, email, phone, name, birth_year, roles) -> User:
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create_user(email=email, password=self.password, full_name=name,
                                            birth_year=birth_year, phone=phone)
        for role in roles:
            UserRole.objects.get_or_create(user=user, role=role)
        for kind, target in ((Verification.Kind.EMAIL, user.email), (Verification.Kind.PHONE, user.phone)):
            Verification.objects.get_or_create(
                user=user, kind=kind, target=target,
                defaults={"status": Verification.Status.VERIFIED, "verified_at": timezone.now()},
            )
        ensure_profiles(user)
        return user

    def _set_langs_interests(self, user, langs, interests):
        for code, prof in langs:
            UserLanguage.objects.get_or_create(user=user, language=Language.objects.get(code=code),
                                               defaults={"proficiency": prof})
        for slug in interests:
            UserInterest.objects.get_or_create(user=user, interest=Interest.objects.get(slug=slug))

    def _traveler(self, spec) -> User:
        user = self._user(spec["email"], spec["phone"], spec["name"], spec["birth_year"], [UserRole.Role.TRAVELER])
        profile = user.profile
        profile.display_name = spec["display"]
        profile.bio = f'{spec["bio"]}\n\n{DEMO_NOTE.format(role="travelers")}'
        profile.save()
        TravelerProfile.objects.filter(user=user).update(
            travel_style=spec["style"], wishes=spec["wishes"], avoid_notes=spec["avoid"],
        )
        self._set_langs_interests(user, spec["langs"], spec["interests"])
        return user

    def _local(self, spec) -> User:
        user = self._user(spec["email"], spec["phone"], spec["name"], spec["birth_year"],
                          [UserRole.Role.LOCAL, UserRole.Role.TRAVELER])
        city = City.objects.get(slug=spec["city"])
        profile = user.profile
        profile.display_name = spec["display"]
        profile.bio = f'{spec["bio"]}\n\n{DEMO_NOTE.format(role="locals")}'
        profile.city = city
        profile.save()
        local = LocalProfile.objects.get(user=user)
        local.experience_summary = spec["experience"]
        local.years_experience = spec["years"]
        local.areas_description = spec["areas"]
        local.support_skills = spec["skills"]
        local.price_min, local.price_max = spec["price"]
        local.pricing_note = "For a group of up to 3 people. Exact hours and price agreed in chat before confirming."
        if local.review_status == LocalProfile.ReviewStatus.NOT_SUBMITTED:  # keep any decision staff made since
            local.review_status = spec["review"]
        local.save()
        self._set_langs_interests(user, spec["langs"], spec["interests"])
        self._profile_images(user, spec)
        for cat, title, desc, minutes, price, included, excluded, photos in spec["services"]:
            service, _ = LocalService.objects.get_or_create(
                local=user, title=title,
                defaults={"category": ServiceCategory.objects.get(slug=cat), "city": city, "description": desc,
                          "duration_minutes": minutes, "price": price, "included": included,
                          "excluded": excluded, "location_name": spec["areas"].split(",")[0]},
            )
            if service.city_id != city.id:  # the demo local moved city since an earlier seed
                service.city = city
                service.save(update_fields=["city", "updated_at"])
            if self.replace_images or not service.photos.exists():
                service.photos.all().delete()
                for order, code in enumerate(photos):
                    image, thumbnail = self._seed_image(code, process_photo)
                    ServicePhoto.objects.create(service=service, image=image, thumbnail=thumbnail, sort_order=order)
        if not user.availability.filter(end_at__gte=timezone.now()).exists():
            today = timezone.localtime().replace(hour=8, minute=0, second=0, microsecond=0)
            LocalAvailability.objects.bulk_create([
                LocalAvailability(local=user, start_at=today + timedelta(days=d), end_at=today + timedelta(days=d, hours=12))
                for d in range(1, 31) if d % 3 != 0
            ])
        if spec["years"] >= 5 and not user.external_reviews.exists():
            ExternalReviewSource.objects.create(
                user=user, platform=ExternalReviewSource.Platform.GOOGLE,
                url="https://maps.google.com/", rating_text="4.9/5 (37 reviews)",
                note="Reviews from my previous hosting",
            )
        return user

    @staticmethod
    def _seed_image(code, process):
        folder, stem = IMAGE_DIRS[code[0]]
        path = SEED_IMAGES / folder / f"{stem}_{int(code[1:]):02d}.jpg"
        with path.open("rb") as fh:
            return process(File(fh, name=path.name))

    def _profile_images(self, user, spec):
        """Not every local has an avatar or a background photo (15 and 16 of 20); the spec says which do.

        Without --replace-images, pictures a demo local already has (e.g. uploaded by hand) are kept.
        """
        profile = user.profile
        if spec.get("avatar") and (self.replace_images or not profile.avatar):
            profile.avatar = self._seed_image(spec["avatar"], process_avatar)
            profile.save(update_fields=["avatar", "updated_at"])
        elif self.replace_images and profile.avatar and not spec.get("avatar"):
            profile.avatar = ""
            profile.save(update_fields=["avatar", "updated_at"])
        if self.replace_images or not user.photos.exists():
            user.photos.all().delete()
            if spec.get("background"):
                image, thumbnail = self._seed_image(spec["background"], process_photo)
                ProfilePhoto.objects.create(user=user, image=image, thumbnail=thumbnail)

    def _history(self, traveler, local, rating, comment, reply):
        if Booking.objects.filter(traveler=traveler, local=local).exists():
            return
        service = local.services.first()
        start = timezone.now() - timedelta(days=15 + Booking.objects.count() * 3)
        req = TourRequest.objects.create(
            traveler=traveler, local=local, city=local.profile.city, start_at=start, end_at=start + timedelta(hours=3),
            group_size=1, wishes=service.title if service else "Local walk", status=TourRequest.Status.ACCEPTED,
            responded_at=start - timedelta(days=3),
        )
        price = service.price if service else 600000
        booking = Booking.objects.create(
            tour_request=req, traveler=traveler, local=local, service=service, start_at=req.start_at, end_at=req.end_at,
            group_size=1, status=Booking.Status.COMPLETED, confirmed_at=start - timedelta(days=2),
            completed_at=req.end_at,
        )
        agreement = Agreement.objects.create(
            booking=booking, version=1, proposed_by=local, status=Agreement.Status.ACCEPTED,
            meeting_point=f"{local.local_profile.areas_description.split(',')[0]}, agreed in chat",
            start_at=req.start_at, end_at=req.end_at, group_size=1,
            scope=service.description[:200] if service else "Walking tour", price=price,
            included=service.included if service else "Guide fee", excluded=service.excluded if service else "",
            cancellation_policy="Free cancellation up to 24h before",
            local_accepted_at=start - timedelta(days=3), traveler_accepted_at=start - timedelta(days=2),
        )
        ItineraryStop.objects.create(agreement=agreement, order=0, time="09:00",
                                     place_name=service.location_name if service else "Meeting point",
                                     activity=service.title if service else "Walk", kind="SIGHTSEEING")
        booking.current_agreement = agreement
        booking.agreed_price = price
        booking.save()
        open_conversation(booking)
        Review.objects.create(booking=booking, reviewer=traveler, reviewee=local, reviewee_role="LOCAL", rating=rating,
                              comment=comment, felt_safe=True, itinerary_respected=True, price_as_agreed=True)
        Review.objects.create(booking=booking, reviewer=local, reviewee=traveler, reviewee_role="TRAVELER", rating=5,
                              comment=reply)

    def _moderation_samples(self, travelers, locals_):
        """Local development only: give the staff console something to work on."""
        minji, khoa = travelers["minji"], locals_["khoa"]
        if not Report.objects.filter(reporter=minji).exists():
            Report.objects.create(
                reporter=minji, reported_user=khoa, booking=Booking.objects.filter(traveler=minji, local=khoa).first(),
                category=Report.Category.NO_SHOW, severity=Report.Severity.LOW,
                description="Khoa arrived 40 minutes late to the meeting point and didn't message us. (Demo report)",
            )
        trang = locals_["trang"]
        if not trang.external_reviews.exists():
            ExternalReviewSource.objects.create(
                user=trang, platform=ExternalReviewSource.Platform.FACEBOOK, url="https://facebook.com/",
                rating_text="4.7/5 (18 reviews)", note="Reviews of my café's food walks",
            )
