import {initializeApp} from 'firebase-admin/app';

initializeApp();

export {onRunCreate} from './onRunCreate';
export {stoneScheduler} from './stoneScheduler';
export {saveAccountSettings} from './account';
export {socialAction} from './social';
export {roomAction} from './rooms';
