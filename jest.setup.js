// 화면 전환 애니메이션은 테스트에서 끄고 바로 끝난 상태로 만든다. 전환 로직(어느 화면이 되는지)은 그대로 검증한다
const { motion } = require('./src/navigation/motion');

motion.enabled = false;
