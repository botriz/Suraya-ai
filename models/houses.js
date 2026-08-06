const SurayaHouseModel = {
    createBasicHouse() {
        const group = new THREE.Group();

        // بدنهٔ خانه
        const bodyGeometry = new THREE.BoxGeometry(4, 3, 4);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xf2d2b6 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        group.add(body);

        // سقف
        const roofGeometry = new THREE.ConeGeometry(3.5, 2, 4);
        const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xb5651d });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 4;
        roof.rotation.y = Math.PI / 4;
        group.add(roof);

        return group;
    }
};
