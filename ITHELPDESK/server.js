require('dotenv').config();
const express = require('express');
const path = require('path');
    
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cors = require('cors');
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, addDoc, getDocs, getDoc, deleteDoc, query, where, orderBy, limit, getCountFromServer, doc, setDoc,  updateDoc } = require("firebase/firestore");

// إعداد Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD4IQSUq6uOJ8uOWRGiCXXX",
  authDomain: "itdb-6e840.firebaseapp.com",
  projectId: "itdb-6e840",
  storageBucket: "itdb-6e840.appspot.com",
  messagingSenderId: "772504782181",
  appId: "1:772504782181:web:667ecfb8eea7d558074d8c",
  measurementId: "G-NKL02WJVZB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const expressApp = express();
const PORT = 3000;

expressApp.use(cors()); // إضافة CORS
expressApp.use(express.static(path.join(__dirname, 'public')));
expressApp.use(express.json()); // هذا مهم لتلقي البيانات بصيغة JSON
expressApp.use(express.urlencoded({ extended: true }));
expressApp.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
// مسار لتحديث تواريخ الباك أب
expressApp.put('/api/devices/:deviceId', async (req, res) => {
    const deviceId = req.params.deviceId; // هنا يتم الحصول على deviceId من المسار
    const { lastBackupDate, nextBackupDate } = req.body;

    // التحقق من صحة التواريخ
    if (!lastBackupDate || isNaN(Date.parse(lastBackupDate)) || !nextBackupDate || isNaN(Date.parse(nextBackupDate))) {
        return res.status(400).json({ error: 'Invalid date values' });
    }

    try {
        await updateDeviceBackupDatesInDatabase(deviceId, lastBackupDate, nextBackupDate);
        res.status(200).json({ message: 'تم تحديث تواريخ الباك أب بنجاح.' });
    } catch (error) {
        console.error('Error updating backup dates:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث تواريخ الباك أب.' });
    }
});

// دالة لتحديث تواريخ الباك أب في قاعدة البيانات
async function updateDeviceBackupDatesInDatabase(deviceId, lastBackupDate, nextBackupDate) {
    const deviceRef = doc(db, 'devices', deviceId);
    await updateDoc(deviceRef, {
        lastBackupDate: lastBackupDate,
        nextBackupDate: nextBackupDate
    });
}

expressApp.get('/api/complaints/:complaintId', async (req, res) => {
    const { complaintId } = req.params;

    try {
        const complaintDoc = await getDoc(doc(db, "complaints", complaintId));
        if (!complaintDoc.exists()) {
            console.error(`Complaint not found: ${complaintId}`);
            return res.status(404).json({ error: 'الشكوى غير موجودة.' });
        }

        res.status(200).json(complaintDoc.data());
    } catch (err) {
        console.error(`Error fetching complaint: ${err}`);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الشكوى.' });
    }
});


// مسار لتحديث الشكوى كتم حلها
expressApp.post('/api/complaints/:complaintId/resolve', async (req, res) => {
    const { complaintId } = req.params;

    try {
        const complaintRef = doc(db, "complaints", complaintId);
        await updateDoc(complaintRef, {
            resolved: true
        });
        res.status(200).json({ message: 'تم تحديث الشكوى بنجاح.' });
    } catch (err) {
        console.error('خطأ أثناء تحديث الشكوى:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث الشكوى.' });
    }
});
expressApp.get('/api/getUsername', (req, res) => {
    if (req.session.username) {
        res.json({ username: req.session.username });
    } else {
        res.status(401).json({ error: 'لم يتم تسجيل الدخول' });
    }
});
// مسار لإضافة التعليقات
expressApp.post('/api/complaints/:complaintId/comments', async (req, res) => {
    const { complaintId } = req.params;
    const { text } = req.body;

    // التحقق من حالة تسجيل الدخول
    if (!req.session.username) {
        return res.status(401).json({ error: 'يرجى تسجيل الدخول لإضافة التعليقات.' });
    }

    try {
        // التحقق من حالة الشكوى
        const complaintDoc = await getDoc(doc(db, "complaints", complaintId));
        if (!complaintDoc.exists()) {
            return res.status(404).json({ error: 'الشكوى غير موجودة.' });
        }

        if (complaintDoc.data().resolved) {
            return res.status(403).json({ error: 'لا يمكن إضافة تعليقات إلى شكوى تم حلها.' });
        }

        if (!text) {
            return res.status(400).json({ error: 'يرجى كتابة التعليق.' });
        }

        const newComment = {
            text,
            timestamp: new Date().toISOString(),
            username: req.session.username // الحصول على اسم المستخدم من الجلسة
        };

        const docRef = await addDoc(collection(db, "complaints", complaintId, "comments"), newComment);
        return res.status(201).json({ id: docRef.id, ...newComment });
    } catch (err) {
        console.error('خطأ أثناء إضافة التعليق:', err);
        return res.status(500).json({ error: 'حدث خطأ أثناء إضافة التعليق.' });
    }
});

// مسار لحذف جهاز معين من قسم معين
expressApp.delete('/api/department/:departmentId/devices/:deviceId', async (req, res) => {
    const { departmentId, deviceId } = req.params;

    try {
        const deviceRef = doc(db, 'departments', departmentId, 'devices', deviceId);
        const deviceSnapshot = await getDoc(deviceRef);

        // تحقق مما إذا كان الجهاز موجودًا قبل الحذف
        if (!deviceSnapshot.exists()) {
            return res.status(404).json({ error: 'الجهاز غير موجود.' });
        }

        await deleteDoc(deviceRef); // حذف الجهاز من قاعدة البيانات
        res.sendStatus(200); // إرجاع حالة نجاح
    } catch (error) {
        console.error('Error deleting device:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الجهاز.' });
    }
});

// مسار إضافة المستخدمين
expressApp.post('/api/users', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const docRef = await addDoc(collection(db, "users"), {
            username,
            email,
            password: hashedPassword
        });
        res.status(201).json({ id: docRef.id, username, email });
    } catch (err) {
        console.error('خطأ أثناء إضافة المستخدم:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المستخدم.' });
    }
});
expressApp.get('/api/users', async (req, res) => {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const users = [];
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            users.push({ id: doc.id, username: userData.username, email: userData.email });
        });
        res.json(users);
    } catch (err) {
        console.error('خطأ أثناء استرجاع المستخدمين:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء استرجاع المستخدمين.' });
    }
});
expressApp.post('/api/regions', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول.' });
    }
    try {
        const docRef = await addDoc(collection(db, "regions"), { name });
        res.status(201).json({ id: docRef.id, name });
    } catch (err) {
        console.error('خطأ أثناء إضافة المنطقة:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المنطقة.' });
    }
});
// مسار استرجاع المستخدمين
expressApp.get('/api/users', async (req, res) => {
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const users = [];
        querySnapshot.forEach((doc) => {
            const userData = doc.data();
            users.push({ id: doc.id, username: userData.username, email: userData.email });
        });
        res.json(users);
    } catch (err) {
        console.error('خطأ أثناء استرجاع المستخدمين:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء استرجاع المستخدمين.' });
    }
});

// مسار حذف المستخدمين
expressApp.delete('/api/users/:id', async (req, res) => {
    try {
        await deleteDoc(doc(db, "users", req.params.id));
        res.sendStatus(200);
    } catch (err) {
        console.error('خطأ أثناء حذف المستخدم:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف المستخدم.' });
    }
});


// مسار لاسترجاع التعليقات
expressApp.get('/api/complaints/:complaintId/comments', async (req, res) => {
    const { complaintId } = req.params;
    try {
        const commentsQuery = query(collection(db, "complaints", complaintId, "comments"), orderBy("timestamp"));
        const querySnapshot = await getDocs(commentsQuery);
        const comments = [];
        querySnapshot.forEach((doc) => {
            comments.push({ id: doc.id, ...doc.data() });
        });
        res.json(comments);
    } catch (err) {
        console.error('خطأ أثناء استرجاع التعليقات:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء استرجاع التعليقات.' });
    }
});


// مسار اضافة الشكاوى

expressApp.post('/api/complaints', async (req, res) => {
    const { text, status, complainantName, complainantDepartment } = req.body; // لا حاجة لdate هنا
    if (!text || !status || !complainantName || !complainantDepartment) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول.' });
    }
    try {
        const docRef = await addDoc(collection(db, "complaints"), {
            text,
            status,
            complainantName,
            complainantDepartment,
            date: new Date().toISOString(), // تعيين التاريخ هنا
            timestamp: new Date() // يمكنك إضافة timestamp أيضًا إذا كنت بحاجة لذلك
        });
        res.status(201).json({ id: docRef.id, text, status, complainantName, complainantDepartment });
    } catch (err) {
        console.error('خطأ أثناء إضافة الشكوى:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة الشكوى.' });
    }
});
// مسار استرجاع الشكاوى مع دعم الصفحات
expressApp.get('/api/complaints', async (req, res) => {
    const page = parseInt(req.query.page) || 0; // الصفحة الحالية (0 أو 1)
    const limit = parseInt(req.query.limit) || 20; // عدد الشكاوى في الصفحة
    const offset = page * limit; // حساب الإزاحة

    try {
        const complaintsQuery = query(collection(db, "complaints"), orderBy("timestamp", "desc")); // ترتيب حسب timestamp بترتيب تنازلي
        const querySnapshot = await getDocs(complaintsQuery);
        const complaints = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            complaints.push({
                id: doc.id,
                ...data,
                timestamp: data.timestamp.toDate() // تحويل timestamp إلى كائن Date
            });
        });

        // تطبيق الصفحات
        const paginatedComplaints = complaints.slice(offset, offset + limit);
        res.json(paginatedComplaints);
    } catch (err) {
        console.error('خطأ أثناء استرجاع الشكاوى:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء استرجاع الشكاوى.' });
    }
});


// مسار لإضافة قسم جديد


expressApp.post('/api/departments', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول.' });
    }

    try {
        console.log('Department name:', name); // طباعة اسم المكتب للتحقق

        // تحقق مما إذا كان المكتب موجودًا بالفعل
        const querySnapshot = await getDocs(query(collection(db, "departments"), where("name", "==", name)));
        if (!querySnapshot.empty) {
            return res.status(400).json({ error: 'هذا المكتب موجود بالفعل.' });
        }

        // قم بإنشاء مكتب جديد باستخدام الاسم كمعرف
        const departmentRef = doc(db, "departments", name); // استخدام الاسم كمعرف
        await setDoc(departmentRef, { name }); // حفظ المكتب باسمه

        // إرجاع تفاصيل المكتب المضاف
        res.status(201).json({ id: name, name }); // id هو اسم المكتب
    } catch (err) {
        console.error('خطأ أثناء إضافة المكتب:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المكتب.' });
    }
});


// مسار لجلب جميع الأقسام
expressApp.get('/api/departments', async (req, res) => {
    try {
        const departmentsSnapshot = await getDocs(collection(db, 'departments'));
        const departments = departmentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        res.status(200).json(departments);
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الأقسام' });
    }
});



// مسار لإضافة جهاز جديد إلى قسم معين
expressApp.post('/api/department/:departmentId/devices', async (req, res) => {
    const { departmentId } = req.params;
    const deviceData = req.body;

    try {
        const departmentRef = collection(db, 'departments', departmentId, 'devices');
        await addDoc(departmentRef, deviceData);
        res.status(201).json({ message: 'تمت إضافة الجهاز بنجاح' });
    } catch (error) {
        console.error('Error adding device:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة الجهاز' });
    }
});
// جلب الموظفين بناءً على اسم القسم
expressApp.get('/api/department/:departmentId/employees', async (req, res) => {
    const { departmentId } = req.params;

    try {
        const employeesRef = collection(db, 'departments', departmentId, 'employees');
        const employeesSnapshot = await getDocs(employeesRef);
        const employees = employeesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.status(200).json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الموظفين.' });
    }
});

// جلب الأجهزة بناءً على اسم القسم
expressApp.get('/api/department/:departmentId/devices', async (req, res) => {
    const { departmentId } = req.params;

    try {
        const devicesRef = collection(db, 'departments', departmentId, 'devices');
        const devicesSnapshot = await getDocs(devicesRef);
        const devices = devicesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.status(200).json(devices);
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الأجهزة' });
    }
});
// مسار لجلب جميع الأجهزة من كل الأقسام
expressApp.get('/api/devices', async (req, res) => {
    try {
        const departmentsSnapshot = await getDocs(collection(db, 'departments'));
        const devices = [];
        for (const departmentDoc of departmentsSnapshot.docs) {
            const departmentId = departmentDoc.id;
            const devicesSnapshot = await getDocs(collection(db, 'departments', departmentId, 'devices'));
            devicesSnapshot.forEach(deviceDoc => {
                devices.push({
                    ...deviceDoc.data(),
                    department: departmentId
                });
            });
        }
        res.status(200).json(devices);
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الأجهزة' });
    }
});

// مسار لتحديث بيانات الموظف
expressApp.put('/api/department/:departmentId/employees/:employeeId', async (req, res) => {
    const { departmentId, employeeId } = req.params;
    const { name, username, password } = req.body;

    try {
        const employeeRef = doc(db, 'departments', departmentId, 'employees', employeeId);
        await setDoc(employeeRef, { name, username, password }, { merge: true });
        res.status(200).json({ message: 'تم تحديث بيانات الموظف بنجاح.' });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث بيانات الموظف.' });
    }
});
expressApp.delete('/api/department/:departmentId/employees/:employeeId', async (req, res) => {
    const { departmentId, employeeId } = req.params;

    try {
        const employeeRef = doc(db, 'departments', departmentId, 'employees', employeeId);
        await deleteDoc(employeeRef);
        res.status(200).json({ message: 'تم حذف الموظف بنجاح' });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف الموظف' });
    }
});
expressApp.delete('/api/department/:departmentId', async (req, res) => {
    const { departmentId } = req.params;

    try {
        const departmentRef = doc(db, 'departments', departmentId);
        await deleteDoc(departmentRef);
        res.status(200).json({ message: 'تم حذف القسم بنجاح' });
    } catch (error) {
        console.error('Error deleting department:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف القسم' });
    }
});

// مسار لإضافة موظف جديد إلى قسم معين
expressApp.post('/api/department/:departmentId/employees', async (req, res) => {
    const { departmentId } = req.params;
    const employeeData = req.body;
    
    try {
        const departmentRef = collection(db, 'departments', departmentId, 'employees');
        await addDoc(departmentRef, employeeData);
        res.status(201).json({ message: 'تمت إضافة الموظف بنجاح' });
    } catch (error) {
        console.error('Error adding employee:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة الموظف' });
    }
});

// تعريف المسار للتحديث
expressApp.put('/api/department/:department/devices/:deviceId', async (req, res) => {
    const { department, deviceId } = req.params;
    const updatedDevice = req.body;

    try {
        const deviceRef = doc(db, 'departments', department, 'devices', deviceId);
        await setDoc(deviceRef, updatedDevice, { merge: true });
        res.status(200).json({ message: 'تم تحديث الجهاز بنجاح' });
    } catch (error) {
        console.error('Error updating device:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث الجهاز.' });
    }
});


// مسار لجلب جميع الموظفين من كل الأقسام
expressApp.get('/api/employees', async (req, res) => {
    try {
        const departmentsSnapshot = await getDocs(collection(db, 'departments'));
        const employees = [];
        for (const departmentDoc of departmentsSnapshot.docs) {
            const departmentId = departmentDoc.id;
            const employeesSnapshot = await getDocs(collection(db, 'departments', departmentId, 'employees'));
            employeesSnapshot.forEach(employeeDoc => {
                employees.push({
                    ...employeeDoc.data(),
                    department: departmentId
                });
            });
        }
        res.status(200).json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء جلب الموظفين' });
    }
});

// مسار إضافة المناطق (جديد)
expressApp.post('/api/regions', async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول.' });
    }
    try {
        const docRef = await addDoc(collection(db, "regions"), { name });
        res.status(201).json({ id: docRef.id, name });
    } catch (err) {
        console.error('خطأ أثناء إضافة المنطقة:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المنطقة.' });
    }
});

// مسار استرجاع المناطق (جديد)
expressApp.get('/api/regions', async (req, res) => {
    try {
        const querySnapshot = await getDocs(collection(db, "regions"));
        const regions = [];
        querySnapshot.forEach((doc) => {
            regions.push({ id: doc.id, ...doc.data() });
        });
        res.json(regions);
    } catch (err) {
        console.error('خطأ أثناء استرجاع المناطق:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء استرجاع المناطق.' });
    }
});


// مسار إضافة المكاتب (معدل)
expressApp.post('/api/offices', async (req, res) => {
    const { name, region } = req.body;
    if (!name || !region) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول.' });
    }
    try {
        const docRef = await addDoc(collection(db, "offices"), { name, region });
        res.status(201).json({ id: docRef.id, name, region });
    } catch (err) {
        console.error('خطأ أثناء إضافة المكتب:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء إضافة المكتب.' });
    }
});

// مسار استرجاع المكاتب
expressApp.get('/api/offices', async (req, res) => {
    try {
        const querySnapshot = await getDocs(collection(db, "offices"));
        const offices = [];
        querySnapshot.forEach((doc) => {
            offices.push({ id: doc.id, ...doc.data() });
        });
        res.json(offices);
    } catch (err) {
        console.error('خطأ أثناء استرجاع المكاتب:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء استرجاع المكاتب.' });
    }
});

// مسار تحديث المكتب
expressApp.put('/api/offices/:id', async (req, res) => {
    const { name, location } = req.body;
    if (!name || !location) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول.' });
    }
    try {
        const officeRef = doc(db, "offices", req.params.id);
        await updateDoc(officeRef, {
            name,
            location
        });
        res.json({ id: req.params.id, name, location });
    } catch (err) {
        console.error('خطأ أثناء تحديث المكتب:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث المكتب.' });
    }
});


// مسار تحديث المنطقة
expressApp.put('/api/regions/:id', async (req, res) => {
    const { name, description } = req.body;
    if (!name || !description) {
        return res.status(400).json({ error: 'يرجى ملء جميع الحقول.' });
    }
    try {
        const regionRef = doc(db, "regions", req.params.id);
        await updateDoc(regionRef, {
            name,
            description
        });
        res.json({ id: req.params.id, name, description });
    } catch (err) {
        console.error('خطأ أثناء تحديث المنطقة:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تحديث المنطقة.' });
    }
});

// مسار حذف المنطقة
expressApp.delete('/api/regions/:id', async (req, res) => {
    try {
        await deleteDoc(doc(db, "regions", req.params.id));
        res.sendStatus(200);
    } catch (err) {
        console.error('خطأ أثناء حذف المنطقة:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف المنطقة.' });
    }
});
// مسار حذف المكتب
expressApp.delete('/api/offices/:name', async (req, res) => {
    try {
        const officesRef = collection(db, "offices");
        const q = query(officesRef, where("name", "==", req.params.name));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'المكتب غير موجود.' });
        }

        const docToDelete = querySnapshot.docs[0];
        await deleteDoc(docToDelete.ref);
        
        res.sendStatus(200);
    } catch (err) {
        console.error('خطأ أثناء حذف المكتب:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف المكتب.' });
    }
});
// مسار حذف منطقة
expressApp.delete('/api/regions/:name', async (req, res) => {
    try {
        const regionsRef = collection(db, "regions");
        const q = query(regionsRef, where("name", "==", req.params.name));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return res.status(404).json({ error: 'المنطقة غير موجودة.' });
        }

        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        // حذف جميع المكاتب المرتبطة بهذه المنطقة
        const officesRef = collection(db, "offices");
        const officesQuery = query(officesRef, where("region", "==", req.params.name));
        const officesSnapshot = await getDocs(officesQuery);
        const officeDeletePromises = officesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(officeDeletePromises);

        res.status(200).json({ message: 'تم حذف المنطقة والمكاتب المرتبطة بها بنجاح' });
    } catch (err) {
        console.error('خطأ أثناء حذف المنطقة:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء حذف المنطقة.' });
    }
});





// مسار تسجيل الدخول
expressApp.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        let user;
        usersSnapshot.forEach((doc) => {
            if (doc.data().username === username) {
                user = { id: doc.id, ...doc.data() };
            }
        });

        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
        }

        // تخزين اسم المستخدم في الجلسة
        req.session.userId = user.id;
        req.session.username = user.username; // تخزين اسم المستخدم

        // تخزين اسم المستخدم في sessionStorage
        res.send({ username: user.username }); // إرسال اسم المستخدم إلى العميل
    } catch (err) {
        console.error('حدث خطأ أثناء تسجيل الدخول:', err);
        res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول.' });
    }
});


// مسار تسجيل الخروج
expressApp.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الخروج.' });
        }
        res.sendStatus(200);
    });
});

// التحقق من الجلسة
expressApp.get('/api/checkSession', (req, res) => {
    if (req.session.userId) {
        res.sendStatus(200); // الجلسة نشطة
    } else {
        res.sendStatus(401); // الجلسة غير نشطة
    }
});

// بدء السيرفر
expressApp.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});