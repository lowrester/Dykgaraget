import multer from 'multer'
import path from 'path'
import fs from 'fs'

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/instructors'
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        cb(null, dir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.round(Math.random() * 1e9))
        const ext = path.extname(file.originalname)
        cb(null, `instructor-${uniqueSuffix}${ext}`)
    }
})

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true)
    } else {
        cb(new Error('Endast bilder är tillåtna!'), false)
    }
}

export const uploadInstructorPhoto = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
})
