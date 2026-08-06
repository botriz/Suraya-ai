<script src="models/farm.js"></script>
index.html
suraya-core.js
world-3d.js   ← این را باید اضافه کنی
models/
styles.css
// ساخت یک مزرعه در دهکده
const farm = SurayaFarmModel.createBasicFarm();
farm.position.set(-10, 0, 5); // جای مزرعه در نقشه
scene.add(farm);
