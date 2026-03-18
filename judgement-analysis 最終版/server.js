const express = require('express');
const mysql = require('mysql2/promise'); // 使用 Promise API 更方便
const cors = require('cors');
const multer = require('multer'); // 引入 multer 來處理文件上傳
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const port = 3000;

const pool = mysql.createPool({
  host: 'your host',
  user: 'your username',
  password: 'your password',
  database: 'your database',
  port: 'your port',
  connectionLimit: 'your connection limit'
});

async function getUserEmailById(userId) {
  try {
    const [rows] = await pool.execute(
      'SELECT EMAIL FROM `Accounts` WHERE id = ?', 
      [userId]
    );
    return rows.length > 0 ? rows[0].EMAIL : null;
  } catch (error) {
    console.error('查詢電子郵件失敗:', error);
    return null;
  }
}

// 發送登入通知的函數
function sendLoginNotification(email, userName) {
  const loginTime = new Date().toLocaleString();
  const text = `您好，${userName}，您剛剛登入了您的 Mr.Judger 帳戶。時間：${loginTime}。如果這不是您本人操作，請立即聯繫開發團隊，謝謝。`;

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'mr.judgerdevelopmentteam@gmail.com',
      pass: 'snwh xdpz ihuu vjrb'
    }
  });

  const mailOptions = {
    from: 'Mr.JudgerDevelopmentTeam@gmail.com',
    to: email,
    subject: 'Mr.Judger登入通知',
    text: text
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(`發送登入通知失敗: ${error}`);
    } else {
      console.log(`登入通知已發送: ${info.response}`);
    }
  });
}

// 設置 API 端點來接收 userId 和 userName
app.post('/loginNotification', async (req, res) => {
  const { userId, userName } = req.body;

  try {
    const email = await getUserEmailById(userId);
    if (!email) {
      return res.status(404).json({ message: '找不到使用者的電子郵件地址' });
    }
    sendLoginNotification(email, userName);
    res.status(200).json({ message: '登入通知已發送' });
  } catch (error) {
    console.error('發送登入通知時發生錯誤:', error);
    res.status(500).json({ message: '發送登入通知失敗' });
  }
});

app.use(cors({
  origin: 'http://localhost:8000'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/getCases', async (req, res) => {
  const { judgeName = '', caseResult = '' } = req.query;

  try {
    const connection = await pool.getConnection();

    // 根據 `caseResult` 是否存在動態生成查詢語句
    const sqlQuery1 = caseResult
      ? `SELECT id, 裁判案由, 法官姓名, DATE_FORMAT(裁判日期, '%Y-%m-%d') AS 裁判日期, 內文
        FROM \`判決書分析比對系統_db\`.\`Table\`
        WHERE 裁判案由 = ? AND 判決結果 LIKE ?`
      : `SELECT id, 裁判案由, 法官姓名, DATE_FORMAT(裁判日期, '%Y-%m-%d') AS 裁判日期, 內文
        FROM \`判決書分析比對系統_db\`.\`Table\`
        WHERE 裁判案由 = ?`;

    const sqlQuery2 = `
      SELECT id, 裁判案由, 法官姓名, DATE_FORMAT(裁判日期, '%Y-%m-%d') AS 裁判日期, 內文
      FROM \`判決書分析比對系統_db\`.\`Table\`
      WHERE 裁判案由 = ?`;

    const queryParams1 = caseResult ? [judgeName, `%${caseResult}%`] : [judgeName];
    const queryParams2 = [judgeName];

    //DISTINCT和UNION確保去重
    const [rows] = await connection.execute(`
      SELECT id, 裁判案由, 法官姓名, 裁判日期, 內文
      FROM (
        SELECT DISTINCT id, 裁判案由, 法官姓名, 裁判日期, 內文
        FROM (
          (${sqlQuery1})
          UNION
          (${sqlQuery2})
        ) AS combined_results
      ) AS unique_results
      ORDER BY RAND()
      LIMIT 10
    `, [...queryParams1, ...queryParams2]);

    connection.release();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ message: '伺服器發生錯誤' });
  }
});

app.listen(port, () => {
  console.log(`伺服器正在執行於 http://localhost:${port}`);
});


app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const connection = await pool.getConnection();
    const [existingUser] = await connection.execute(`
      SELECT * FROM \`判決書分析比對系統_db\`.\`Accounts\` WHERE EMAIL = ?
    `, [email]);

    if (existingUser.length > 0) {
      connection.release();
      return res.status(400).json({ message: '此帳號已被註冊' });
    }

    const [result] = await connection.execute(`
      INSERT INTO \`判決書分析比對系統_db\`.\`Accounts\` (NAME, EMAIL, PASSWORD)
      VALUES (?, ?, ?);
    `, [username, email, password]);

    connection.release();
    res.status(200).json({ message: '註冊成功', userId: result.insertId });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: '伺服器發生錯誤' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT ID, NAME, PASSWORD, HEADSHOT, IMAGE_FORMAT FROM \`判決書分析比對系統_db\`.\`Accounts\` WHERE EMAIL = ?
    `, [email]);

    if (rows.length === 0 || rows[0].PASSWORD !== password) {
      connection.release();
      return res.status(401).json({ success: false, message: '帳號或密碼錯誤' });
    }

    // 提取資料庫中的資料
    const { ID: id, NAME: name, HEADSHOT: headshotData, IMAGE_FORMAT: imageFormat } = rows[0];
    connection.release();
    
    // 直接使用資料庫中的 imageFormat 設定 MIME type
    const mimeType = `image/${imageFormat}`;
    
    // 構建圖片的 base64 URL
    const headshotUrl = headshotData
      ? `data:${mimeType};base64,${headshotData}`
      : 'images/profile.png';    
    
    // 發送登入通知
    sendLoginNotification(email, name); // 發送登入通知

    // 回應資料
    console.log('MIME type:', mimeType);
    res.json({ success: true, id, headshot: headshotUrl, name });
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ success: false, message: '伺服器發生錯誤' });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
      cb(null, './uploads/');
  },
  filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ dest: 'uploads/' });

app.post('/uploadProfilePic', upload.single('profile-pic'), async (req, res) => {
  const { file } = req;
  const userId = req.body.userId;

  if (!userId || !file) {
    return res.status(400).json({ success: false, message: 'Missing userId or file' });
  }

  try {
    // 讀取檔案內容並轉換為 Base64 編碼
    const fileData = fs.readFileSync(file.path);
    const base64Image = fileData.toString('base64');
    const fileType = file.mimetype.split('/')[1]; // 獲取文件類型 (例如 'jpeg', 'png')

    // 將 Base64 編碼和圖片格式儲存到資料庫
    const connection = await pool.getConnection();
    await connection.execute(`
      UPDATE \`判決書分析比對系統_db\`.\`Accounts\`
      SET HEADSHOT = ?, IMAGE_FORMAT = ?
      WHERE ID = ?
    `, [base64Image, fileType, userId]);

    connection.release();
    res.json({ success: true, headshot: `data:image/${fileType};base64,${base64Image}` });
  } catch (error) {
    console.error('處理上傳檔案時發生錯誤:', error);
    res.status(500).json({ success: false, message: '內部伺服器錯誤' });
  }
});

app.post('/updateName', async (req, res) => {
  const { newName, userId } = req.body;

  if (!userId || !newName) {
    return res.status(400).json({ success: false, message: 'Missing userId or newName' });
  }

  try {
    const connection = await pool.getConnection();
    await connection.execute(`
      UPDATE \`判決書分析比對系統_db\`.\`Accounts\`
      SET NAME = ?
      WHERE ID = ?
    `, [newName, userId]);

    connection.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({ success: false, message: 'Error updating name' });
  }
});

app.post('/verifyPassword', async (req, res) => {
  const { userId, currentPassword } = req.body;

  try {
      const connection = await pool.getConnection();
      const [rows] = await connection.execute(`
          SELECT PASSWORD FROM \`判決書分析比對系統_db\`.\`Accounts\` WHERE ID = ?
      `, [userId]);

      if (rows.length === 0 || rows[0].PASSWORD !== currentPassword) {
          connection.release();
          return res.status(401).json({ success: false, message: '密碼錯誤' });
      }

      connection.release();
      res.json({ success: true });
  } catch (error) {
      console.error('Error verifying password:', error);
      res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

app.post('/updatePassword', async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
      return res.status(400).json({ success: false, message: '缺少userId或新密碼' });
  }

  try {
      const connection = await pool.getConnection();
      await connection.execute(`
          UPDATE \`判決書分析比對系統_db\`.\`Accounts\`
          SET PASSWORD = ?
          WHERE ID = ?
      `, [newPassword, userId]);

      connection.release();
      res.json({ success: true, message: '密碼已更新' });
  } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

app.post('/searchCases', async (req, res) => {
  const { startYear, startMonth, startDay, endYear, endMonth, endDay, reason, mainText } = req.body;
  
  // 輸入驗證
  if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) {
    return res.status(400).json({ message: '日期欄位不能為空' });
  }

  // 日期格式驗證和清理
  const startDate = new Date(`${startYear}-${startMonth}-${startDay}`);
  const endDate = new Date(`${endYear}-${endMonth}-${endDay}`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ message: '無效的日期格式' });
  }

  try {
    const connection = await pool.getConnection();
    const query = `
      SELECT * 
      FROM \`判決書分析比對系統_db\`.\`Table\`
      WHERE 裁判日期 BETWEEN ? AND ?
       AND (? IS NULL OR ? = '' OR 裁判案由 LIKE CONCAT('%', ?, '%'))
      AND REPLACE(REPLACE(REPLACE(主文, CHAR(10), ''), CHAR(13), ''), ' ', '') LIKE ?
      ORDER BY 裁判日期 DESC
      LIMIT 100;
    `;
    
    const likeMainText = `%${mainText}%`;
    const [rows] = await connection.execute(query, [startDate, endDate, reason, reason, reason, likeMainText]);
    connection.release();
    res.json(rows);
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ message: '伺服器發生錯誤' });
  }
});

app.post('/searchLaws', async (req, res) => {
  const { keyword } = req.body;

  if (!keyword) {
    return res.status(400).json({ message: '關鍵字為必填' });
  }

  try {
    const connection = await pool.getConnection();
    const [results] = await connection.execute(`
      SELECT * FROM 民法知識庫
      WHERE 法律名稱 LIKE ? OR 條文內容 LIKE ?
    `, [`%${keyword}%`, `%${keyword}%`]);

    connection.release();

    res.json(results);
  } catch (error) {
    console.error('Error searching laws:', error);
    res.status(500).json({ message: '伺服器錯誤', error: error.message });
  }
});

app.post('/save-history', async (req, res) => {
  const { userId, fullPdfText, geminiText } = req.body;

  let connection;
  try {
      connection = await pool.getConnection();

      const query = `
          INSERT INTO \`判決書分析比對系統_db\`.History (userId, fullPdfText, geminiText)
          VALUES (?, ?, ?)
      `;

      await connection.query(query, [userId, fullPdfText, geminiText]);
  } catch (error) {
      console.error('Error saving history:', error);
      res.status(500).send('Error saving history.');
  } finally {
      if (connection) connection.release();
  }
});

app.post('/historicalRecord', async (req, res) => {
  try {
    const { userId } = req.body;

    // 查詢歷史記錄的 SQL 語句
    const query = `
      SELECT fullPdfText, geminiText FROM History 
      WHERE userId = ?;
    `;
    const [rows] = await pool.query(query, [userId]);

    // 如果找到記錄，返回數據；否則返回提示信息
    if (rows.length > 0) {
      res.json({ success: true, data: rows });
      console.log(`已查詢到 ${rows.length} 筆資料`);
    } else {
      res.json({ success: false, message: 'The records found for this user is empty. 您的歷史紀錄為空。' });
    }
  } catch (error) {
    console.error('Error fetching historical records:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/getJudgeResults', async (req, res) => {
  const judgeName = req.query.judgeName;

  try {
    const judgeResults = {};
      const [rows] = await pool.execute(`SELECT 法官姓名, 原告勝率 FROM \`Table\` WHERE 裁判案由 = ? AND 原告勝率 IN (0, 1)`,[judgeName]);

      rows.forEach(row => {
          const { 法官姓名, 原告勝率 } = row;
          const winRate = Number(原告勝率);

          if (!judgeResults[法官姓名]) {
              judgeResults[法官姓名] = { win: 0, lose: 0, total: 0 };
          }
      
          if (winRate === 0) {
              judgeResults[法官姓名].lose++;
          } else if (winRate === 1) {
              judgeResults[法官姓名].win++;
          }
      
          judgeResults[法官姓名].total++;
          console.log("原告勝率 === 0:",judgeResults[法官姓名].lose);
          console.log("原告勝率 === 1:",judgeResults[法官姓名].win);
          console.log("法官姓名:",法官姓名);
          console.log("total:",judgeResults[法官姓名].total);
      });

      // 計算每位法官的百分比
      const result = Object.keys(judgeResults).map(judgeName => {
          const { win, lose, total } = judgeResults[judgeName];
          const winPercentage = ((win / total) * 100).toFixed(2);
          const losePercentage = ((lose / total) * 100).toFixed(2);

          return { judgeName, winPercentage, losePercentage };
      });

      // 返回結果
      res.json(result);
  } catch (error) {
      console.error('Error querying judge results:', error); // 顯示錯誤日誌
      res.status(500).json({ message: 'Internal Server Error', error: error.message });  // 返回錯誤訊息
  }
});
