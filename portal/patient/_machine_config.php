<?php
/**
 * @package Patient
 *
 * MACHINE-SPECIFIC CONFIGURATION SETTINGS
 *
 * The configuration settings in this file can be changed to suit the
 * machine on which the app is running (ex. local, staging or production).
 *
 * This file should not be added to version control, rather a template
 * file should be added instead and then copied for each install
 *
 * From phreeze package
 * @license http://www.gnu.org/copyleft/lesser.html LGPL
 *
 */
/* */

	session_start();
	if ( isset($_SESSION['pid']) && isset($_SESSION['patient_portal_onsite_two']) ) {
		$pid = $_SESSION['pid'];
		$ignoreAuth = true;
		 GlobalConfig::$PORTAL = true;
		 require_once ( dirname( __FILE__ ) . "/../../interface/globals.php" );
	}
	else {
		session_destroy();
		GlobalConfig::$PORTAL = false;
		$ignoreAuth = false;
		require_once ( dirname( __FILE__ ) . "/../../interface/globals.php" );
		if ( ! isset($_SESSION['authUserID']) ){
			$landingpage = "index.php";
			header('Location: '.$landingpage);
			exit;
		}
	}

require_once 'verysimple/Phreeze/ConnectionSetting.php';
require_once ( "verysimple/HTTP/RequestUtil.php" );

/**
 * database connection settings
 */
GlobalConfig::$CONNECTION_SETTING = new ConnectionSetting();
GlobalConfig::$CONNECTION_SETTING->ConnectionString = $GLOBALS['host'] . ":" . $GLOBALS['port'];
GlobalConfig::$CONNECTION_SETTING->DBName = $GLOBALS['dbase'];
GlobalConfig::$CONNECTION_SETTING->Username = $GLOBALS['login'];
GlobalConfig::$CONNECTION_SETTING->Password = $GLOBALS['pass'];
GlobalConfig::$CONNECTION_SETTING->Type = "MySQLi";
if (!$disable_utf8_flag) {
    GlobalConfig::$CONNECTION_SETTING->Charset = "utf8";
}
GlobalConfig::$CONNECTION_SETTING->Multibyte = true;
// Turn off STRICT SQL
GlobalConfig::$CONNECTION_SETTING->BootstrapSQL = "SET sql_mode = '', time_zone = '" .
  (new DateTime())->format("P") . "'";

/**
 * the root url of the application with trailing slash, for example http://localhost/patient/
 */
  GlobalConfig::$ROOT_URL = RequestUtil::GetServerRootUrl() . preg_replace('/^\//', '', $GLOBALS['web_root']) . '/portal/patient/';

/**
 * timezone
 */
// date_default_timezone_set("UTC");

/**
 * functions for php 5.2 compatibility
 */
if( ! function_exists( 'lcfirst' ) ){
	function lcfirst( $string ){
		return substr_replace( $string, strtolower( substr( $string, 0, 1 ) ), 0, 1 );
	}
}

// if Multibyte support is specified then we need to check if multibyte functions are available
// if you receive this error then either install multibyte extensions or set Multibyte to false
if( GlobalConfig::$CONNECTION_SETTING->Multibyte && ! function_exists( 'mb_strlen' ) ) die( '<html>Multibyte extensions are not installed but Multibyte is set to true in _machine_config.php</html>' );

/**
 * level 2 cache
 */
// require_once('verysimple/Util/MemCacheProxy.php');
// GlobalConfig::$LEVEL_2_CACHE = new MemCacheProxy(array('localhost'=>'11211'));
// GlobalConfig::$LEVEL_2_CACHE_TEMP_PATH = sys_get_temp_dir();
// GlobalConfig::$LEVEL_2_CACHE_TIMEOUT = 5; // default is 5 seconds which will not be highly noticable to the user

?>