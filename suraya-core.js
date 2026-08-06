// ===============================
//   هستهٔ فردی کشور ثریا
//   Personal Core Unit - Suraya
// ===============================

const SurayaPersonalCore = {
    // ایجاد کوچک‌ترین واحد وجود
    createUnit() {
        return {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            stage: "seed",          // seed → person → family → village → city → ...
            energy: 1,              // توان اولیه
            awareness: 0,           // آگاهی
            value: 0,               // ارزش تولیدشده
            history: ["ایجاد هستهٔ اولیه"]
        };
    },

    // رشد از هسته به فرد دیجیتال
    evolveToPerson(unit) {
        unit.stage = "person";
        unit.awareness += 1;
        unit.history.push("تبدیل به فرد دیجیتال");
        return unit;
    },

    // تبدیل فرد به عضو خانواده
    joinFamily(unit, familyId) {
        unit.stage = "family_member";
        unit.familyId = familyId;
        unit.history.push(`عضو خانواده ${familyId}`);
        return unit;
    },

    // ثبت ارزش تولیدشده
    addValue(unit, amount) {
        unit.value += amount;
        unit.history.push(`تولید ارزش: ${amount}`);
        return unit;
    }
};
