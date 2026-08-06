// models/farm.js
const SurayaFarmModel = {
    createBasicFarm() {
        const group = new THREE.Group();

        // زمین مزرعه
        const groundGeometry = new THREE.PlaneGeometry(8, 8);
        const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x9acd32 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        group.add(ground);

        // ردیف‌های کشت
        const rowGeometry = new THREE.BoxGeometry(8, 0.2, 0.5);
        const rowMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b });

        for (let i = -3; i <= 3; i += 1.5) {
            const row = new THREE.Mesh(rowGeometry, rowMaterial);
            row.position.set(0, 0.1, i);
            group.add(row);
        }

        // انبار کوچک کنار مزرعه
        const storageGeometry = new THREE.BoxGeometry(2, 2, 2);
        const storageMaterial = new THREE.MeshStandardMaterial({ color: 0xc2b280 });
        const storage = new THREE.Mesh(storageGeometry, storageMaterial);
        storage.position.set(-4, 1, -4);
        group.add(storage);

        return group;
    }
};
